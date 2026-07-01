import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { getDb } from "../db";
import { mealLogs } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/** Return the ISO date string (YYYY-MM-DD) for a given Date (UTC) */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function avg(vals: (number | null | undefined)[]): number | null {
  const valid = vals.filter((v): v is number => v != null && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function sum(vals: (number | null | undefined)[]): number {
  return vals.reduce<number>((a, b) => a + (b ?? 0), 0);
}

function skinfoldTotal(m: {
  umbilical1?: number | null; umbilical2?: number | null; umbilical3?: number | null; umbilical4?: number | null; umbilical5?: number | null;
  suprailiac1?: number | null; suprailiac2?: number | null; suprailiac3?: number | null; suprailiac4?: number | null; suprailiac5?: number | null;
  calf1?: number | null; calf2?: number | null; calf3?: number | null; calf4?: number | null; calf5?: number | null;
  thigh1?: number | null; thigh2?: number | null; thigh3?: number | null; thigh4?: number | null; thigh5?: number | null;
}): number | null {
  const sites = [
    avg([m.umbilical1, m.umbilical2, m.umbilical3, m.umbilical4, m.umbilical5]),
    avg([m.suprailiac1, m.suprailiac2, m.suprailiac3, m.suprailiac4, m.suprailiac5]),
    avg([m.calf1, m.calf2, m.calf3, m.calf4, m.calf5]),
    avg([m.thigh1, m.thigh2, m.thigh3, m.thigh4, m.thigh5]),
  ];
  const valid = sites.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0);
}

type WeekPeriod = {
  weekStart: string;
  weekEnd: string;
  label: string;
  isInProgress: boolean;
};

/**
 * Build simple 7-day week periods from anchorDate to today.
 * Returns newest-first.
 */
function buildPeriods(
  anchorDate: string,
  today: Date,
  maxWeeks = 104,
  tzOffsetMinutes = 0
): WeekPeriod[] {
  const msPerDay = 24 * 60 * 60 * 1000;
  const msPerWeek = 7 * msPerDay;

  const localMs = today.getTime() + tzOffsetMinutes * 60 * 1000;
  const localToday = new Date(localMs);
  const todayStr = toDateStr(new Date(Date.UTC(localToday.getUTCFullYear(), localToday.getUTCMonth(), localToday.getUTCDate())));
  const todayMs = new Date(todayStr + "T00:00:00Z").getTime();

  const anchorMs = new Date(anchorDate + "T00:00:00Z").getTime();
  if (anchorMs > todayMs) return [];

  const weeksSince = Math.floor((todayMs - anchorMs) / msPerWeek);
  const periods: WeekPeriod[] = [];

  // Current in-progress week
  const curWeekStartMs = anchorMs + weeksSince * msPerWeek;
  const curWeekEndMs = curWeekStartMs + msPerWeek - msPerDay;
  const curLabel = `${new Date(curWeekStartMs).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })} \u2013 ${new Date(curWeekEndMs).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })}`;
  periods.push({
    weekStart: toDateStr(new Date(curWeekStartMs)),
    weekEnd: toDateStr(new Date(curWeekEndMs)),
    label: curLabel,
    isInProgress: true,
  });

  // Completed weeks (newest first)
  for (let i = 1; i <= weeksSince && periods.length <= maxWeeks; i++) {
    const weekIdx = weeksSince - i;
    const weekStartMs = anchorMs + weekIdx * msPerWeek;
    const weekEndMs = weekStartMs + msPerWeek - msPerDay;
    const label = `${new Date(weekStartMs).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })} \u2013 ${new Date(weekEndMs).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })}`;
    periods.push({
      weekStart: toDateStr(new Date(weekStartMs)),
      weekEnd: toDateStr(new Date(weekEndMs)),
      label,
      isInProgress: false,
    });
  }

  return periods;
}

export const progressRouter = router({
  weeklyReview: protectedProcedure
    .input(z.object({ clientId: z.number(), tzOffsetMinutes: z.number().optional().default(0) }))
    .query(async ({ input }) => {
      const { clientId, tzOffsetMinutes } = input;

      const dbConn = await getDb();
      const allMealLogs = dbConn
        ? await dbConn.select().from(mealLogs).where(eq(mealLogs.userId, clientId))
        : [];

      const [profile, logs, meas, sessions] = await Promise.all([
        db.getClientProfile(clientId),
        db.getDailyLogs(clientId, 9999),
        db.getMeasurements(clientId),
        db.listWorkoutSessions(clientId),
      ]);

      if (!profile) {
        return { weeks: [] };
      }

      const today = new Date();

      // Determine anchor date: earliest log date, or profile startDate, whichever is earlier
      const startDateStr = profile.startDate
        ? (typeof profile.startDate === "string" ? profile.startDate : toDateStr(profile.startDate as Date))
        : null;

      const logDates = logs.map((l) =>
        typeof l.logDate === "string" ? l.logDate : toDateStr(l.logDate as Date)
      );
      const earliestLog = logDates.length > 0 ? logDates.reduce((a, b) => (a < b ? a : b)) : null;

      const anchorDate = startDateStr ?? earliestLog;
      if (!anchorDate) return { weeks: [] };

      const periods = buildPeriods(anchorDate, today, 104, tzOffsetMinutes);

      const rawWeeks = periods.map((period) => {
        const periodLogs = logs.filter((l) => {
          const d = typeof l.logDate === "string" ? l.logDate : toDateStr(l.logDate as Date);
          return d >= period.weekStart && d <= period.weekEnd;
        });
        const periodMeas = meas.filter((m) => {
          const d = typeof m.measureDate === "string" ? m.measureDate : toDateStr(m.measureDate as Date);
          return d >= period.weekStart && d <= period.weekEnd;
        });
        const periodSessions = sessions.filter((s) => {
          const d = typeof s.sessionDate === "string" ? s.sessionDate : toDateStr(s.sessionDate as Date);
          return d >= period.weekStart && d <= period.weekEnd;
        });

        // Body composition
        const avgWeight = avg(periodLogs.map((l) => l.weight));
        const avgWaist = avg(periodMeas.map((m) => m.waist));
        const avgHip = avg(periodMeas.map((m) => m.hips));
        const avgSkinfold = periodMeas.length > 0
          ? avg(periodMeas.map((m) => skinfoldTotal(m)))
          : null;

        // Training
        const sessionsCompleted = periodSessions.length;

        // Nutrition (daily log)
        const avgCaffeine = avg(periodLogs.map((l) => l.caffeineServings));

        // Nutrition (meal logs)
        const periodMealLogs = allMealLogs.filter((m) => {
          const d = m.loggedAt instanceof Date ? m.loggedAt.toISOString().slice(0, 10) : String(m.loggedAt).slice(0, 10);
          return d >= period.weekStart && d <= period.weekEnd;
        });
        const mealsOnly = periodMealLogs.filter((m) => m.mealType === "meal");
        const mealLogCount = mealsOnly.length;
        const mealLogTreats = periodMealLogs.filter((m) => m.mealType === "treat").length;
        const ratedMeals = mealsOnly.filter((m) => m.hungerRating != null && m.fullnessRating != null);
        const idealZoneMeals = ratedMeals.filter((m) => m.hungerRating! >= 3 && m.hungerRating! <= 4 && m.fullnessRating! >= 6 && m.fullnessRating! <= 7);
        const mealLogAvgHunger = avg(mealsOnly.map((m) => m.hungerRating));
        const mealLogAvgFullness = avg(mealsOnly.map((m) => m.fullnessRating));
        const mealLogIdealZonePct = ratedMeals.length > 0 ? Math.round((idealZoneMeals.length / ratedMeals.length) * 100) : null;

        // Recovery
        const avgHunger = avg(periodLogs.map((l) => l.hungerLevel));
        const avgSleepQuality = avg(periodLogs.map((l) => l.sleepQuality));
        const avgStress = avg(periodLogs.map((l) => (l as any).stressLevel));
        const avgSleepHours = avg(periodLogs.map((l) => l.sleepHours));

        // Activity
        const avgSteps = avg(periodLogs.map((l) => l.stepsCount));
        const stepGoal = profile.stepGoal ?? null;

        // Raw weigh-ins for expanded view
        const weighIns = periodLogs
          .filter((l) => l.weight != null)
          .map((l) => ({
            logDate: typeof l.logDate === "string" ? l.logDate : toDateStr(l.logDate as Date),
            weight: l.weight as number,
          }))
          .sort((a, b) => a.logDate.localeCompare(b.logDate));

        // Raw measurements for expanded view
        const measurementEntries = periodMeas.map((m) => ({
          id: m.id,
          measureDate: typeof m.measureDate === "string" ? m.measureDate : toDateStr(m.measureDate as Date),
          waist: m.waist ?? null,
          hips: m.hips ?? null,
          umbilical: avg([m.umbilical1, m.umbilical2, m.umbilical3, m.umbilical4, m.umbilical5]),
          suprailiac: avg([m.suprailiac1, m.suprailiac2, m.suprailiac3, m.suprailiac4, m.suprailiac5]),
          calf: avg([m.calf1, m.calf2, m.calf3, m.calf4, m.calf5]),
          thigh: avg([m.thigh1, m.thigh2, m.thigh3, m.thigh4, m.thigh5]),
          totalSkinfold: skinfoldTotal(m),
          umbilicalReadings: [m.umbilical1, m.umbilical2, m.umbilical3, m.umbilical4, m.umbilical5],
          suprailiacReadings: [m.suprailiac1, m.suprailiac2, m.suprailiac3, m.suprailiac4, m.suprailiac5],
          calfReadings: [m.calf1, m.calf2, m.calf3, m.calf4, m.calf5],
          thighReadings: [m.thigh1, m.thigh2, m.thigh3, m.thigh4, m.thigh5],
        })).sort((a, b) => a.measureDate.localeCompare(b.measureDate));

        return {
          weekStart: period.weekStart,
          weekEnd: period.weekEnd,
          label: period.label,
          isInProgress: period.isInProgress,
          daysLogged: periodLogs.length,
          // Body composition
          avgWeight,
          avgWaist,
          avgHip,
          avgSkinfold,
          // Expanded detail
          weighIns,
          measurementEntries,
          // Training
          sessionsCompleted,
          // Nutrition
          avgCaffeine,
          mealLogCount,
          mealLogTreats,
          mealLogAvgHunger: mealLogAvgHunger != null ? parseFloat(mealLogAvgHunger.toFixed(1)) : null,
          mealLogAvgFullness: mealLogAvgFullness != null ? parseFloat(mealLogAvgFullness.toFixed(1)) : null,
          mealLogIdealZonePct,
          // Recovery
          avgHunger,
          avgSleepQuality,
          avgSleepHours,
          avgStress,
          // Activity
          avgSteps,
          stepGoal,
        };
      });

      // Keep ALL periods from start date (including empty ones) — the UI will show them as blank rows
      const weeksWithData = rawWeeks;

      // Compute avgWeightPct: % change vs previous week's avgWeight
      const weeks = weeksWithData.map((w, idx) => {
        const prev = weeksWithData[idx + 1] ?? null;
        let avgWeightPct: number | null = null;
        if (w.avgWeight != null && prev?.avgWeight != null && prev.avgWeight !== 0) {
          avgWeightPct = parseFloat(((w.avgWeight - prev.avgWeight) / prev.avgWeight * 100).toFixed(2));
        }
        return { ...w, avgWeightPct };
      });

      // ── Rolling 7-day summary stats (all cards use true calendar windows) ──
      const localMs = today.getTime() + tzOffsetMinutes * 60 * 1000;
      const localToday = new Date(localMs);
      const todayStr = toDateStr(new Date(Date.UTC(localToday.getUTCFullYear(), localToday.getUTCMonth(), localToday.getUTCDate())));
      const msPerDay = 24 * 60 * 60 * 1000;
      const curStartMs = new Date(todayStr + "T00:00:00Z").getTime() - 6 * msPerDay;
      const curStartStr = toDateStr(new Date(curStartMs));
      const prevEndMs = curStartMs - msPerDay;
      const prevStartMs = prevEndMs - 6 * msPerDay;
      const prevStartStr = toDateStr(new Date(prevStartMs));
      const prevEndStr = toDateStr(new Date(prevEndMs));

      // Filter daily logs for each window
      const curLogs = logs.filter((l) => {
        const d = typeof l.logDate === "string" ? l.logDate : toDateStr(l.logDate as Date);
        return d >= curStartStr && d <= todayStr;
      });
      const prevLogs = logs.filter((l) => {
        const d = typeof l.logDate === "string" ? l.logDate : toDateStr(l.logDate as Date);
        return d >= prevStartStr && d <= prevEndStr;
      });

      // Days logged
      const last7DaysLogged = new Set(curLogs.map((l) => typeof l.logDate === "string" ? l.logDate : toDateStr(l.logDate as Date))).size;

      // Sessions
      const last7Sessions = sessions.filter((s) => {
        const d = typeof s.sessionDate === "string" ? s.sessionDate : toDateStr(s.sessionDate as Date);
        return d >= curStartStr && d <= todayStr;
      }).length;
      const prev7Sessions = sessions.filter((s) => {
        const d = typeof s.sessionDate === "string" ? s.sessionDate : toDateStr(s.sessionDate as Date);
        return d >= prevStartStr && d <= prevEndStr;
      }).length;

      // Averages for all daily-log metrics
      const last7AvgWeight     = avg(curLogs.map((l) => l.weight));
      const prev7AvgWeight     = avg(prevLogs.map((l) => l.weight));
      const last7AvgSteps      = avg(curLogs.filter((l) => l.stepsCount != null).map((l) => l.stepsCount));
      const prev7AvgSteps      = avg(prevLogs.filter((l) => l.stepsCount != null).map((l) => l.stepsCount));
      const last7AvgSleepHours = avg(curLogs.filter((l) => l.sleepHours != null).map((l) => l.sleepHours));
      const prev7AvgSleepHours = avg(prevLogs.filter((l) => l.sleepHours != null).map((l) => l.sleepHours));
      const last7AvgSleepQuality = avg(curLogs.filter((l) => l.sleepQuality != null).map((l) => l.sleepQuality));
      const prev7AvgSleepQuality = avg(prevLogs.filter((l) => l.sleepQuality != null).map((l) => l.sleepQuality));
      const last7AvgStress     = avg(curLogs.filter((l) => l.stressLevel != null).map((l) => l.stressLevel));
      const prev7AvgStress     = avg(prevLogs.filter((l) => l.stressLevel != null).map((l) => l.stressLevel));

      const rolling7 = {
        daysLogged: last7DaysLogged,
        sessions: last7Sessions,
        prevSessions: prev7Sessions,
        avgWeight: last7AvgWeight,
        prevAvgWeight: prev7AvgWeight,
        avgSteps: last7AvgSteps,
        prevAvgSteps: prev7AvgSteps,
        avgSleepHours: last7AvgSleepHours,
        prevAvgSleepHours: prev7AvgSleepHours,
        avgSleepQuality: last7AvgSleepQuality,
        prevAvgSleepQuality: prev7AvgSleepQuality,
        avgStress: last7AvgStress,
        prevAvgStress: prev7AvgStress,
        stepGoal: profile.stepGoal ?? null,
      };

      return { weeks, rolling7 };
    }),
});
