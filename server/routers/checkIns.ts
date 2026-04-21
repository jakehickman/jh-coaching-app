import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { adminProcedure } from "./shared";
import * as db from "../db";

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Convert a JS Date (from MySQL date column) to YYYY-MM-DD string using UTC */
function toDateStr(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Add N days to a YYYY-MM-DD string, returning a new YYYY-MM-DD string */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d);
}

/** Today as YYYY-MM-DD in UTC */
function todayUtcStr(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

const DAY_MAP: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
  friday: 5, saturday: 6, sunday: 0,
};

/**
 * Compute the first scheduled check-in date for a client.
 * The first occurrence is the first instance of assignedJsDay on or after startDate,
 * but never on the start date itself (clients don't check in on day 1).
 */
function firstScheduledDate(startDateStr: string, checkInDay: string): string | null {
  const assignedJsDay = DAY_MAP[checkInDay];
  if (assignedJsDay === undefined) return null;

  const start = new Date(startDateStr + "T00:00:00Z");
  const startJsDay = start.getUTCDay();
  const daysUntilFirst = (assignedJsDay - startJsDay + 7) % 7;
  // Always advance at least 7 days so start date is never the first check-in
  const offset = daysUntilFirst === 0 ? 7 : daysUntilFirst;
  return addDays(startDateStr, offset);
}

/**
 * Generate all scheduled check-in dates from firstDate up to and including today + 14 days
 * (to show upcoming occurrences).
 */
function generateOccurrences(firstDateStr: string, upToStr: string): string[] {
  const dates: string[] = [];
  let current = firstDateStr;
  while (current <= upToStr) {
    dates.push(current);
    current = addDays(current, 7);
  }
  return dates;
}

/**
 * Compute the status for a single scheduled occurrence.
 *
 * States:
 *   upcoming     - today < scheduledDate
 *   open         - scheduledDate <= today <= dueDate, no submission
 *   due_today    - today == dueDate, no submission
 *   overdue      - today > dueDate && today <= missedDate, no submission
 *   missed       - today > missedDate, no submission, not skipped
 *   skipped      - coach explicitly skipped this week
 *   completed    - submission exists (on time: submitted <= dueDate)
 *   completed_late - submission exists but submitted after dueDate
 */
export type CheckInStatus =
  | "upcoming"
  | "open"
  | "due_today"
  | "overdue"
  | "missed"
  | "skipped"
  | "completed"
  | "completed_late";

export interface CheckInOccurrence {
  scheduledDate: string;   // YYYY-MM-DD
  dueDate: string;         // scheduledDate + 6 days
  missedDate: string;      // scheduledDate + 14 days
  status: CheckInStatus;
  submittedAt?: Date;
  submissionId?: number;
  reviewedAt?: Date | null;
  weekStartDate?: string;
}

function computeOccurrenceStatus(
  scheduledDate: string,
  today: string,
  submissionWeekDate: string | null,
  submittedAt: Date | null,
  isSkipped: boolean,
): CheckInStatus {
  const dueDate = addDays(scheduledDate, 6);
  const missedDate = addDays(scheduledDate, 14);

  if (isSkipped) return "skipped";

  if (submissionWeekDate === scheduledDate) {
    // Has a submission for this week
    const submittedDateStr = submittedAt ? toDateStr(submittedAt) : scheduledDate;
    return submittedDateStr <= dueDate ? "completed" : "completed_late";
  }

  // No submission
  if (today < scheduledDate) return "upcoming";
  if (today > missedDate) return "missed";
  if (today > dueDate) return "overdue";
  if (today === dueDate) return "due_today";
  return "open";
}

export const checkInRouter = router({
  submit: protectedProcedure
    .input(z.object({
      weekStartDate: z.string(),
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
    .mutation(({ ctx, input }) =>
      db.submitCheckIn({ clientId: ctx.user.id, ...input })
    ),

  myList: protectedProcedure.query(({ ctx }) =>
    db.listCheckInsForClient(ctx.user.id)
  ),

  myWeek: protectedProcedure
    .input(z.object({ weekStartDate: z.string() }))
    .query(({ ctx, input }) =>
      db.getCheckInForWeek(ctx.user.id, input.weekStartDate)
    ),

  clientList: adminProcedure
    .input(z.object({ clientId: z.number() }))
    .query(({ input }) => db.listCheckInsForClient(input.clientId)),

  weekForClient: adminProcedure
    .input(z.object({ clientId: z.number(), weekStartDate: z.string() }))
    .query(({ input }) => db.getCheckInForWeek(input.clientId, input.weekStartDate)),

  markReviewed: adminProcedure
    .input(z.object({ id: z.number(), reviewed: z.boolean() }))
    .mutation(({ input }) => db.markCheckInReviewed(input.id, input.reviewed)),

  latestPerClient: adminProcedure.query(() => db.getLatestCheckInPerClient()),

  /**
   * Returns the current check-in occurrence status for a specific client.
   * Used by the client-side CheckInsTab to show state-aware messaging.
   */
  myCurrentOccurrence: protectedProcedure.query(async ({ ctx }) => {
    const profile = await db.getClientProfile(ctx.user.id);
    if (!profile?.checkInDay || !profile?.startDate) return null;

    const startDateStr = toDateStr(profile.startDate as unknown as Date);
    const firstDate = firstScheduledDate(startDateStr, profile.checkInDay);
    if (!firstDate) return null;

    const today = todayUtcStr();
    const upTo = addDays(today, 14);
    const occurrences = generateOccurrences(firstDate, upTo);

    const submissions = await db.listCheckInsForClient(ctx.user.id);
    const skips = await db.getSkipsForClient(ctx.user.id);

    // Find the most relevant occurrence: the current open/overdue/due_today one,
    // or the most recent past one, or the next upcoming one
    const submissionMap = new Map<string, { submittedAt: Date; id: number; reviewedAt: Date | null; weekStartDate: string }>();
    for (const s of submissions) {
      const wsd = toDateStr(s.weekStartDate as unknown as Date);
      submissionMap.set(wsd, {
        submittedAt: s.submittedAt as unknown as Date,
        id: s.id,
        reviewedAt: s.reviewedAt as unknown as Date | null,
        weekStartDate: wsd,
      });
    }

    const results: CheckInOccurrence[] = occurrences.map(scheduledDate => {
      const sub = submissionMap.get(scheduledDate);
      const isSkipped = skips.includes(scheduledDate);
      const status = computeOccurrenceStatus(
        scheduledDate,
        today,
        sub ? sub.weekStartDate : null,
        sub ? sub.submittedAt : null,
        isSkipped,
      );
      return {
        scheduledDate,
        dueDate: addDays(scheduledDate, 6),
        missedDate: addDays(scheduledDate, 14),
        status,
        submittedAt: sub?.submittedAt,
        submissionId: sub?.id,
        reviewedAt: sub?.reviewedAt,
        weekStartDate: sub?.weekStartDate,
      };
    });

    // Priority: open/due_today > overdue > upcoming (next) > most recent completed/missed
    const active = results.find(o => o.status === "open" || o.status === "due_today" || o.status === "overdue");
    if (active) return active;
    const upcoming = results.find(o => o.status === "upcoming");
    if (upcoming) return upcoming;
    // Return the most recent past occurrence
    const past = [...results].reverse().find(o =>
      o.status === "completed" || o.status === "completed_late" || o.status === "missed" || o.status === "skipped"
    );
    return past ?? null;
  }),

  /**
   * Returns all scheduled occurrences with status for a specific client (coach use).
   */
  clientOccurrences: adminProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const profile = await db.getClientProfile(input.clientId);
      if (!profile?.checkInDay || !profile?.startDate) return [];

      const startDateStr = toDateStr(profile.startDate as unknown as Date);
      const firstDate = firstScheduledDate(startDateStr, profile.checkInDay);
      if (!firstDate) return [];

      const today = todayUtcStr();
      const upTo = addDays(today, 14);
      const occurrences = generateOccurrences(firstDate, upTo);

      const submissions = await db.listCheckInsForClient(input.clientId);
      const skips = await db.getSkipsForClient(input.clientId);

      const submissionMap = new Map<string, any>();
      for (const s of submissions) {
        const wsd = toDateStr(s.weekStartDate as unknown as Date);
        submissionMap.set(wsd, s);
      }

      return occurrences.map(scheduledDate => {
        const sub = submissionMap.get(scheduledDate);
        const isSkipped = skips.includes(scheduledDate);
        const status = computeOccurrenceStatus(
          scheduledDate,
          today,
          sub ? toDateStr(sub.weekStartDate as unknown as Date) : null,
          sub ? sub.submittedAt as unknown as Date : null,
          isSkipped,
        );
        return {
          scheduledDate,
          dueDate: addDays(scheduledDate, 6),
          missedDate: addDays(scheduledDate, 14),
          status,
          submission: sub ?? null,
        };
      }).reverse(); // Most recent first
    }),

  /**
   * Returns per-client status summary for the coach check-ins list.
   * Replaces overdueClients with a richer status model.
   */
  clientStatusList: adminProcedure.query(async ({ ctx }) => {
    const profiles = await db.getAllClients(ctx.user.id);
    const allCheckIns = await db.getAllCheckInsPerClient();
    const allSkips = await db.getAllSkipsPerClient();
    const today = todayUtcStr();

    const result: {
      clientId: number;
      status: CheckInStatus;
      scheduledDate: string | null;
      dueDate: string | null;
    }[] = [];

    for (const profile of profiles) {
      if (!profile.checkInDay || !profile.startDate) {
        result.push({ clientId: profile.userId, status: "upcoming", scheduledDate: null, dueDate: null });
        continue;
      }

      const startDateStr = toDateStr(profile.startDate as unknown as Date);
      const firstDate = firstScheduledDate(startDateStr, profile.checkInDay);
      if (!firstDate) {
        result.push({ clientId: profile.userId, status: "upcoming", scheduledDate: null, dueDate: null });
        continue;
      }

      const upTo = addDays(today, 14);
      const occurrences = generateOccurrences(firstDate, upTo);

      const clientSubmissions = allCheckIns
        .filter((c: any) => c.clientId === profile.userId)
        .map((c: any) => toDateStr(c.weekStartDate as unknown as Date));

      const clientSkips = allSkips
        .filter((s: any) => s.clientId === profile.userId)
        .map((s: any) => s.weekStartDate);

      // Find the most relevant occurrence for this client
      let currentStatus: CheckInStatus = "upcoming";
      let currentScheduled: string | null = null;
      let currentDue: string | null = null;
      let foundHighPriority = false;

      for (const scheduledDate of occurrences) {
        const sub = clientSubmissions.find(wsd => wsd === scheduledDate) ?? null;
        const isSkipped = clientSkips.includes(scheduledDate);
        const status = computeOccurrenceStatus(scheduledDate, today, sub, null, isSkipped);

        if (status === "overdue" || status === "due_today") {
          currentStatus = status as CheckInStatus;
          currentScheduled = scheduledDate;
          currentDue = addDays(scheduledDate, 6);
          foundHighPriority = true;
          break;
        }
        if (status === "open") {
          currentStatus = "open";
          currentScheduled = scheduledDate;
          currentDue = addDays(scheduledDate, 6);
        }
        if ((status === "completed" || status === "completed_late") && !foundHighPriority && currentStatus === "upcoming") {
          currentStatus = status;
          currentScheduled = scheduledDate;
          currentDue = addDays(scheduledDate, 6);
        }
        if (status === "missed" && !foundHighPriority && currentStatus !== "open" && currentStatus !== "completed" && currentStatus !== "completed_late") {
          currentStatus = "missed";
          currentScheduled = scheduledDate;
          currentDue = addDays(scheduledDate, 6);
        }
      }

      result.push({ clientId: profile.userId, status: currentStatus, scheduledDate: currentScheduled, dueDate: currentDue });
    }

    return result;
  }),

  // Keep overdueClients for backward compatibility — now delegates to clientStatusList logic
  overdueClients: adminProcedure.query(async ({ ctx }) => {
    const profiles = await db.getAllClients(ctx.user.id);
    const allCheckIns = await db.getAllCheckInsPerClient();
    const allSkips = await db.getAllSkipsPerClient();
    const today = todayUtcStr();

    const result: { clientId: number; dueDate: Date }[] = [];

    for (const profile of profiles) {
      if (!profile.checkInDay || !profile.startDate) continue;

      const startDateStr = toDateStr(profile.startDate as unknown as Date);
      const firstDate = firstScheduledDate(startDateStr, profile.checkInDay);
      if (!firstDate) continue;

      const upTo = today;
      const occurrences = generateOccurrences(firstDate, upTo);

      const clientSubmissions = allCheckIns
        .filter((c: any) => c.clientId === profile.userId)
        .map((c: any) => toDateStr(c.weekStartDate as unknown as Date));

      const clientSkips = allSkips
        .filter((s: any) => s.clientId === profile.userId)
        .map((s: any) => s.weekStartDate);

      for (const scheduledDate of occurrences) {
        const sub = clientSubmissions.find(wsd => wsd === scheduledDate) ?? null;
        const isSkipped = clientSkips.includes(scheduledDate);
        const status = computeOccurrenceStatus(scheduledDate, today, sub, null, isSkipped);
        if (status === "overdue") {
          result.push({ clientId: profile.userId, dueDate: new Date(scheduledDate + "T00:00:00Z") });
          break;
        }
      }
    }

    return result;
  }),

  // ─── Skip procedures ───────────────────────────────────────────────────────
  skipWeek: adminProcedure
    .input(z.object({ clientId: z.number(), weekStartDate: z.string() }))
    .mutation(async ({ input }) => {
      await db.skipCheckInWeek(input.clientId, input.weekStartDate);
      return { success: true };
    }),

  unskipWeek: adminProcedure
    .input(z.object({ clientId: z.number(), weekStartDate: z.string() }))
    .mutation(async ({ input }) => {
      await db.unskipCheckInWeek(input.clientId, input.weekStartDate);
      return { success: true };
    }),

  clientSkips: adminProcedure
    .input(z.object({ clientId: z.number() }))
    .query(({ input }) => db.getSkipsForClient(input.clientId)),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteCheckIn(input.id)),
});
