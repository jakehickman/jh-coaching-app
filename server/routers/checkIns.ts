import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { adminProcedure } from "./shared";
import * as db from "../db";

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

// ─── Router ───────────────────────────────────────────────────────────────────

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

    return {
      id: cycle.id,
      dueDate: dueDateStr,
      status: displayStatus,
      submissionId: cycle.submissionId ?? null,
      submission,
    };
  }),

  /**
   * CLIENT: Get past completed check-in cycles (history).
   */
  myHistory: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.getCycleHistory(ctx.user.id);
    return rows.map(r => ({
      id: r.id,
      dueDate: toDateStr(r.dueDate),
      completedAt: r.completedAt,
      submissionId: r.submissionId ?? null,
      submission: r.submission,
    }));
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

    return clients.map(client => {
      const cycle = cycleMap.get(client.userId);
      if (!cycle) {
        return {
          clientId: client.userId,
          status: "upcoming" as CycleDisplayStatus,
          dueDate: null as string | null,
          submissionId: null as number | null,
        };
      }
      return {
        clientId: client.userId,
        status: deriveCycleStatus(cycle, today),
        dueDate: toDateStr(cycle.dueDate),
        submissionId: cycle.submissionId ?? null,
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

      return {
        id: cycle.id,
        dueDate: dueDateStr,
        status: displayStatus,
        submissionId: cycle.submissionId ?? null,
        submission,
      };
    }),

  /**
   * COACH: Get check-in history for a specific client.
   */
  clientHistory: adminProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const rows = await db.getCycleHistory(input.clientId);
      return rows.map(r => ({
        id: r.id,
        dueDate: toDateStr(r.dueDate),
        completedAt: r.completedAt,
        submissionId: r.submissionId ?? null,
        submission: r.submission,
      }));
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
   * COACH: Mark a submission as reviewed / unreviewed.
   */
  markReviewed: adminProcedure
    .input(z.object({ id: z.number(), reviewed: z.boolean() }))
    .mutation(({ input }) => db.markCheckInReviewed(input.id, input.reviewed)),

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
