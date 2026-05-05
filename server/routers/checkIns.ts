import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { adminProcedure } from "./shared";
import * as db from "../db";
import { notifyOwner } from "../_core/notification";

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Convert a JS Date (from MySQL date column) to YYYY-MM-DD string using UTC */
function toDateStr(d: Date | string | unknown): string {
  if (d instanceof Date) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  return String(d).slice(0, 10);
}

/** Today as YYYY-MM-DD in UTC */
function todayUtcStr(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Derive the display status for a cycle.
 * - submitted  = status is 'submitted' (regardless of dueDate)
 * - overdue    = status is 'upcoming' AND today > dueDate
 * - upcoming   = status is 'upcoming' AND today <= dueDate
 */
export type CycleDisplayStatus = "upcoming" | "overdue" | "submitted";

function deriveCycleStatus(cycle: { status: string; dueDate: Date | string }, today: string): CycleDisplayStatus {
  if (cycle.status === "submitted") return "submitted";
  const dueDateStr = toDateStr(cycle.dueDate);
  return today > dueDateStr ? "overdue" : "upcoming";
}

// ─── Week number helper ─────────────────────────────────────────────────────

const DAY_NAME_TO_DOW: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

/**
 * Given a client's startDate, checkInDay, and a dueDate string,
 * return the 1-based week number aligned with buildWeekPeriods in progress.ts.
 * W1 = first scheduled check-in week (oldest), Wn = most recent.
 */
function computeWeekNumber(
  startDate: string | null | undefined,
  checkInDay: string | null | undefined,
  dueDate: string,
): number | null {
  if (!startDate || !checkInDay) return null;
  const dow = DAY_NAME_TO_DOW[checkInDay.toLowerCase()];
  if (dow === undefined) return null;
  const start = new Date(startDate + "T00:00:00Z");
  const startDow = start.getUTCDay();
  let daysUntilFirst = (dow - startDow + 7) % 7;
  if (daysUntilFirst === 0) daysUntilFirst = 7;
  const firstDue = new Date(start);
  firstDue.setUTCDate(start.getUTCDate() + daysUntilFirst);
  const firstDueMs = firstDue.getTime();
  const dueDateMs = new Date(dueDate + "T00:00:00Z").getTime();
  if (dueDateMs < firstDueMs) return null;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.round((dueDateMs - firstDueMs) / msPerWeek) + 1;
}

// ─── Router ─────────────────────────────────────────────────────────────────────

export const checkInRouter = router({

  /**
   * CLIENT: Get the current active cycle for the logged-in client.
   * Returns the cycle with derived status (upcoming/overdue/submitted)
   * and the submission Q&A if status is submitted.
   */
  myCurrentCycle: protectedProcedure.query(async ({ ctx }) => {
    const cycle = await db.getActiveCycle(ctx.user.id);
    if (!cycle) return null;

    const today = todayUtcStr();
    const displayStatus = deriveCycleStatus(cycle, today);
    const dueDateStr = toDateStr(cycle.dueDate);

    let submission = null;
    if (cycle.submissionId) {
      submission = await db.getCheckInForWeek(ctx.user.id, dueDateStr);
    }

    const profile = await db.getClientProfile(ctx.user.id);
    const weekNumber = computeWeekNumber(
      profile?.startDate ? toDateStr(profile.startDate) : null,
      profile?.checkInDay ?? null,
      dueDateStr,
    );
    return {
      id: cycle.id,
      dueDate: dueDateStr,
      status: displayStatus,
      submissionId: cycle.submissionId ?? null,
      submission,
      checkInDay: profile?.checkInDay ?? null,
      weekNumber,
    };
  }),

  /**
   * CLIENT: Get past completed check-in cycles (history).
   */
  myHistory: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.getCycleHistory(ctx.user.id);
    const profile = await db.getClientProfile(ctx.user.id);
    return rows.map(r => {
      const dueDateStr = toDateStr(r.dueDate);
      return {
        id: r.id,
        dueDate: dueDateStr,
        completedAt: r.completedAt,
        submissionId: r.submissionId ?? null,
        submission: r.submission,
        weekNumber: computeWeekNumber(
          profile?.startDate ? toDateStr(profile.startDate) : null,
          profile?.checkInDay ?? null,
          dueDateStr,
        ),
      };
    });
  }),

  /**
   * CLIENT: Check whether the client has already submitted a check-in for the
   * most recent occurrence of their check-in day (i.e. today, if today IS their
   * check-in day).  This is used to hide the banner / dot even after the coach
   * has reviewed and advanced the cycle (which resets status to 'upcoming').
   */
  myHasSubmittedThisWeek: protectedProcedure.query(async ({ ctx }) => {
    const profile = await db.getClientProfile(ctx.user.id);
    const checkInDay = profile?.checkInDay;
    if (!checkInDay) return false;

    const DAY_MAP: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    const targetDow = DAY_MAP[checkInDay.toLowerCase()];
    if (targetDow === undefined) return false;

    // Compute the most recent occurrence of checkInDay (today if today IS that day)
    const now = new Date();
    const todayDow = now.getUTCDay();
    const daysBack = (todayDow - targetDow + 7) % 7;
    const checkInDate = new Date(now);
    checkInDate.setUTCDate(now.getUTCDate() - daysBack);
    const checkInDateStr = checkInDate.toISOString().slice(0, 10);

    const submission = await db.getCheckInForWeek(ctx.user.id, checkInDateStr);
    return submission !== null;
  }),

  /**
   * CLIENT: Submit a check-in for the current cycle.
   * Uses the cycle's dueDate as the weekStartDate for the submission record.
   */
  submit: protectedProcedure
    .input(z.object({
      dietWeighedFoods: z.enum(["every_meal","most_meals","some_meals","rarely","never"]).optional(),
      dietMealPrepAccuracy: z.enum(["every_meal","most_meals","some_meals","rarely","never"]).optional(),
      dietExtrasFrequency: z.enum(["never","one_two_days","few_days","most_days","every_day"]).optional(),
      dietAddedFats: z.enum(["light_spray","small_amount","one_tsp_or_more","no_added_fats"]).optional(),
      dietMealTiming: z.enum(["never","one_two_days","few_days","most_days","every_day"]).optional(),
      dietOffPlanQuality: z.enum(["very_close","somewhat_close","not_very_close","very_different","no_off_plan_meals"]).optional(),
      sleepBedtimeConsistency: z.enum(["never","one_two_days","few_days","most_days","every_day"]).optional(),
      adherenceBarrier: z.enum(["no_issues","hunger","cravings","social_events","busy_time","poor_planning","low_motivation","travel_disruption","other"]).optional(),
      barrierExplain: z.string().max(500).optional(),
      weeklyAssessment: z.enum(["executed_exactly","mostly_followed","inconsistent","didnt_follow"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const cycle = await db.getActiveCycle(ctx.user.id);
      if (!cycle) throw new Error("No active check-in cycle found");

      const dueDateStr = toDateStr(cycle.dueDate);
      const submissionId = await db.submitCycleCheckIn({
        clientId: ctx.user.id,
        weekStartDate: dueDateStr,
        ...input,
      });

      // Notify the coach that a check-in has been submitted
      try {
        const clientProfile = await db.getClientProfile(ctx.user.id);
        const clientName = clientProfile?.displayName ?? ctx.user.name ?? "A client";
        await notifyOwner({
          title: "New Check-in Submitted",
          content: `${clientName} has submitted their weekly check-in.`,
        });
      } catch {
        // Non-critical — don't fail the submission if notification fails
      }

      return { submissionId };
    }),

  /**
   * COACH: Get all clients with their current cycle status.
   * Returns one entry per client with derived status.
   */
  clientStatusList: adminProcedure.query(async ({ ctx }) => {
    const clients = await db.getAllClients(ctx.user.id);
    const cycles = await db.getAllActiveCycles();
    const today = todayUtcStr();

    const cycleMap = new Map(cycles.map(c => [c.clientId, c]));
    // Build profile map for week number computation
    const profileMap = new Map(clients.map(c => [c.userId, c]));

    return clients.map(client => {
      const cycle = cycleMap.get(client.userId);
      const profile = profileMap.get(client.userId);
      if (!cycle) {
        return {
          clientId: client.userId,
          status: "upcoming" as CycleDisplayStatus,
          dueDate: null as string | null,
          submissionId: null as number | null,
          weekNumber: null as number | null,
        };
      }
      const dueDateStr = toDateStr(cycle.dueDate);
      return {
        clientId: client.userId,
        status: deriveCycleStatus(cycle, today),
        dueDate: dueDateStr,
        submissionId: cycle.submissionId ?? null,
        weekNumber: computeWeekNumber(
          profile?.startDate ? toDateStr(profile.startDate) : null,
          profile?.checkInDay ?? null,
          dueDateStr,
        ),
      };
    });
  }),

  /**
   * COACH: Get the current cycle for a specific client (detail view).
   */
  clientCurrentCycle: adminProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const cycle = await db.getActiveCycle(input.clientId);
      if (!cycle) return null;

      const today = todayUtcStr();
      const displayStatus = deriveCycleStatus(cycle, today);
      const dueDateStr = toDateStr(cycle.dueDate);

      let submission = null;
      if (cycle.submissionId) {
        submission = await db.getCheckInForWeek(input.clientId, dueDateStr);
      }

      const profile = await db.getClientProfile(input.clientId);
      const weekNumber = computeWeekNumber(
        profile?.startDate ? toDateStr(profile.startDate) : null,
        profile?.checkInDay ?? null,
        dueDateStr,
      );

      return {
        id: cycle.id,
        dueDate: dueDateStr,
        status: displayStatus,
        submissionId: cycle.submissionId ?? null,
        submission,
        weekNumber,
      };
    }),

  /**
   * COACH: Get check-in history for a specific client.
   */
  clientHistory: adminProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const [rows, profile, activeCycle] = await Promise.all([
        db.getCycleHistory(input.clientId),
        db.getClientProfile(input.clientId),
        db.getActiveCycle(input.clientId),
      ]);
      const startDateStr = profile?.startDate ? toDateStr(profile.startDate) : null;
      const checkInDay = profile?.checkInDay ?? null;

      // Helper to enrich a row with dynamic answers
      async function enrichWithAnswers(submissionId: number | null) {
        if (!submissionId) return [];
        return db.getAnswersForSubmission(submissionId);
      }

      const history = await Promise.all(rows.map(async r => {
        const dueDateStr = toDateStr(r.dueDate);
        const answers = await enrichWithAnswers(r.submissionId ?? null);
        return {
          id: r.id,
          dueDate: dueDateStr,
          completedAt: r.completedAt,
          submissionId: r.submissionId ?? null,
          skipped: r.skipped ?? false,
          submission: r.submission,
          answers,
          weekNumber: computeWeekNumber(startDateStr, checkInDay, dueDateStr),
        };
      }));

      // Also include the current active cycle if it has a submission
      // (active cycles are not in check_in_history until the coach marks them complete)
      if (activeCycle?.submissionId) {
        const dueDateStr = toDateStr(activeCycle.dueDate);
        const weekNumber = computeWeekNumber(startDateStr, checkInDay, dueDateStr);
        // Only add if not already present in history
        if (!history.some(h => h.weekNumber === weekNumber)) {
          const [submission, answers] = await Promise.all([
            db.getCheckInForWeek(input.clientId, dueDateStr),
            enrichWithAnswers(activeCycle.submissionId),
          ]);
          history.unshift({
            id: activeCycle.id,
            dueDate: dueDateStr,
            completedAt: null as any,
            submissionId: activeCycle.submissionId,
            skipped: false,
            submission: submission as any,
            answers,
            weekNumber,
          });
        }
      }
      return history;
    }),

  /**
   * COACH: Mark the current cycle as complete.
   * Archives the current cycle to history, advances dueDate by 7 days, resets to upcoming.
   */
  markComplete: adminProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ input }) => {
      await db.completeCycle(input.clientId);
      return { success: true };
    }),

  /**
   * COACH: Skip the current cycle (client didn't check in).
   * Archives with skipped=true, advances dueDate by 7 days, resets to upcoming.
   */
  skipCycle: adminProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ input }) => {
      await db.skipCycle(input.clientId);
      return { success: true };
    }),

  /**
   * COACH: Mark a submission as reviewed / unreviewed.
   */
  markReviewed: adminProcedure
    .input(z.object({ id: z.number(), reviewed: z.boolean(), clientId: z.number().optional() }))
    .mutation(async ({ input }) => {
      await db.markCheckInReviewed(input.id, input.reviewed);
      // When marking as reviewed, advance the cycle so client moves back to Upcoming
      if (input.reviewed && input.clientId) {
        await db.completeCycle(input.clientId);
      }
    }),

  /**
   * COACH: Save notes for a specific check-in submission.
   */
  saveCoachNotes: adminProcedure
    .input(z.object({ submissionId: z.number(), notes: z.string() }))
    .mutation(async ({ input }) => {
      await db.saveCheckInCoachNotes(input.submissionId, input.notes);
      return { success: true };
    }),

  /**
   * COACH: Save changes-made notes for a specific check-in submission.
   */
  saveChangesNotes: adminProcedure
    .input(z.object({ submissionId: z.number(), notes: z.string() }))
    .mutation(async ({ input }) => {
      await db.saveCheckInChangesNotes(input.submissionId, input.notes);
      return { success: true };
    }),

  // ─── Legacy procedures (kept for backward compatibility) ──────────────────

  /** @deprecated Use myCurrentCycle instead */
  myList: protectedProcedure.query(({ ctx }) =>
    db.listCheckInsForClient(ctx.user.id)
  ),

  /** @deprecated Use clientCurrentCycle instead */
  clientList: adminProcedure
    .input(z.object({ clientId: z.number() }))
    .query(({ input }) => db.listCheckInsForClient(input.clientId)),

  /** @deprecated */
  weekForClient: adminProcedure
    .input(z.object({ clientId: z.number(), weekStartDate: z.string() }))
    .query(({ input }) => db.getCheckInForWeek(input.clientId, input.weekStartDate)),

  /** @deprecated */
  latestPerClient: adminProcedure.query(() => db.getLatestCheckInPerClient()),

  /** @deprecated */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteCheckIn(input.id)),
});
