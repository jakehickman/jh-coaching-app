import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { adminProcedure } from "./shared";
import * as db from "../db";

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
  skipWeek: adminProcedure
    .input(z.object({ clientId: z.number(), weekStartDate: z.string() }))
    .mutation(({ ctx, input }) =>
      db.skipCheckInWeek(input.clientId, ctx.user.id, input.weekStartDate)
    ),
  unskipWeek: adminProcedure
    .input(z.object({ clientId: z.number(), weekStartDate: z.string() }))
    .mutation(({ input }) =>
      db.unskipCheckInWeek(input.clientId, input.weekStartDate)
    ),
  overdueClients: adminProcedure.query(async ({ ctx }) => {
    const profiles = await db.getAllClients(ctx.user.id);
    const allCheckIns = await db.getAllCheckInsPerClient();
    const allSkips = await db.getAllCheckInSkips();

    const dayMap: Record<string, number> = {
      monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
      friday: 5, saturday: 6, sunday: 0,
    };

    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const result: { clientId: number; dueDate: Date }[] = [];

    for (const profile of profiles) {
      if (!profile.checkInDay || !profile.startDate) continue;

      const assignedJsDay = dayMap[profile.checkInDay];
      if (assignedJsDay === undefined) continue;

      const startUtc = new Date(Date.UTC(
        new Date(profile.startDate).getUTCFullYear(),
        new Date(profile.startDate).getUTCMonth(),
        new Date(profile.startDate).getUTCDate()
      ));

      const startJsDay = startUtc.getUTCDay();
      // First check-in is due one full week after start date.
      // If the start date itself falls on the check-in day, skip it — the first
      // due date is the *next* occurrence (7 days later), not the start date.
      const daysUntilFirst = (assignedJsDay - startJsDay + 7) % 7;
      const firstCheckInUtc = new Date(startUtc);
      // Always advance at least 7 days so the start date is never the first due date
      firstCheckInUtc.setUTCDate(startUtc.getUTCDate() + (daysUntilFirst === 0 ? 7 : daysUntilFirst));

      if (firstCheckInUtc > todayUtc) continue;

      // Build a set of covered weekStartDate strings: submissions + coach skips
      const clientWeekStarts = new Set([
        ...allCheckIns
          .filter((c: any) => c.clientId === profile.userId)
          .map((c: any) => c.weekStartDate as string),
        ...allSkips
          .filter((s: any) => s.clientId === profile.userId)
          .map((s: any) => s.weekStartDate as string),
      ]);

      // Helper: format a UTC Date as YYYY-MM-DD
      const toIso = (d: Date) =>
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

      let overdueDate: Date | null = null;
      const scheduled = new Date(firstCheckInUtc);
      while (scheduled <= todayUtc) {
        const scheduledTime = scheduled.getTime();
        // Overdue from the day after the check-in day (no grace period)
        const overdueThreshold = scheduledTime + 1 * 24 * 60 * 60 * 1000;

        if (todayUtc.getTime() >= overdueThreshold) {
          // Match by weekStartDate string — the Monday of the scheduled week
          const hasSubmission = clientWeekStarts.has(toIso(scheduled));
          if (!hasSubmission) {
            overdueDate = new Date(scheduled);
            break;
          }
        }
        scheduled.setUTCDate(scheduled.getUTCDate() + 7);
      }

      if (overdueDate) {
        result.push({ clientId: profile.userId, dueDate: overdueDate });
      }
    }

    return result;
  }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteCheckIn(input.id)),
});
