import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { getDb } from "../db";
import { clientPhases } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";

const DAY_NAME_TO_DOW: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

/**
 * Legacy fallback: anchor weeks to the client's check-in day.
 * Used when no phases have started yet.
 */
function buildWeekPeriods(
  checkInDay: string,
  startDate: string,
  today: Date,
  maxWeeks = 52,
  tzOffsetMinutes = 0
): Array<{ weekStart: string; weekEnd: string; label: string; isInProgress: boolean; weekNumber: number; phaseLabel?: string }> {
  const dow = DAY_NAME_TO_DOW[checkInDay.toLowerCase()] ?? 1;
  const start = new Date(startDate + "T00:00:00Z");
  const startDow = start.getUTCDay();
  let daysUntilFirst = (dow - startDow + 7) % 7;
  if (daysUntilFirst === 0) daysUntilFirst = 7;
  const firstDue = new Date(start);
  firstDue.setUTCDate(start.getUTCDate() + daysUntilFirst);
  const localMs = today.getTime() + tzOffsetMinutes * 60 * 1000;
  const localToday = new Date(localMs);
  const todayMs = Date.UTC(localToday.getUTCFullYear(), localToday.getUTCMonth(), localToday.getUTCDate());
  const firstDueMs = firstDue.getTime();
  if (firstDueMs > todayMs) return [];
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceFirst = Math.floor((todayMs - firstDueMs) / msPerWeek);
  const latestPastDueMs = firstDueMs + weeksSinceFirst * msPerWeek;
  const nextDueMs = latestPastDueMs + msPerWeek;
  const periods: Array<{ weekStart: string; weekEnd: string; label: string; isInProgress: boolean; weekNumber: number; phaseLabel?: string }> = [];
  const inProgressWeekStart = new Date(latestPastDueMs + 24 * 60 * 60 * 1000);
  const inProgressWeekEnd = new Date(nextDueMs);
  const inProgressLabel = `${inProgressWeekStart.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })} \u2013 ${inProgressWeekEnd.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })}`;
  const totalWeeks = weeksSinceFirst + 2;
  periods.push({ weekStart: toDateStr(inProgressWeekStart), weekEnd: toDateStr(inProgressWeekEnd), label: inProgressLabel, isInProgress: true, weekNumber: totalWeeks });
  for (let i = 0; i < maxWeeks; i++) {
    const weekEndMs = latestPastDueMs - i * msPerWeek;
    if (weekEndMs < firstDueMs) break;
    const weekEnd = new Date(weekEndMs);
    const weekStart = new Date(weekEndMs - 6 * 24 * 60 * 60 * 1000);
    const label = `${weekStart.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })} \u2013 ${weekEnd.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })}`;
    periods.push({ weekStart: toDateStr(weekStart), weekEnd: toDateStr(weekEnd), label, isInProgress: false, weekNumber: totalWeeks - 1 - i });
  }
  return periods;
}

/** Return the ISO date string (YYYY-MM-DD) for a given Date (UTC) */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Build weekly periods from phase boundaries.
 * Each phase contributes 7-day blocks starting from phase.startDate.
 * The last block of the current (open-ended) phase may be in-progress.
 * Returns periods newest-first.
 */
function buildPhaseWeekPeriods(
  phases: Array<{ startDate: string; endDate: string | null; label: string }>,
  today: Date,
  tzOffsetMinutes = 0
): Array<{ weekStart: string; weekEnd: string; label: string; isInProgress: boolean; weekNumber: number; phaseLabel: string }> {
  if (phases.length === 0) return [];

  const msPerDay = 24 * 60 * 60 * 1000;
  const msPerWeek = 7 * msPerDay;

  // Compute local today
  const localMs = today.getTime() + tzOffsetMinutes * 60 * 1000;
  const localToday = new Date(localMs);
  const todayStr = toDateStr(new Date(Date.UTC(localToday.getUTCFullYear(), localToday.getUTCMonth(), localToday.getUTCDate())));

  const allPeriods: Array<{ weekStart: string; weekEnd: string; label: string; isInProgress: boolean; weekNumber: number; phaseLabel: string }> = [];

  for (const phase of phases) {
    const phaseStartMs = new Date(phase.startDate + "T00:00:00Z").getTime();
    // Phase end: either explicit endDate or today (open-ended)
    const phaseEndStr = phase.endDate ?? todayStr;
    const phaseEndMs = new Date(phaseEndStr + "T00:00:00Z").getTime();

    if (phaseStartMs > new Date(todayStr + "T00:00:00Z").getTime()) continue; // future phase

    // Slice phase into 7-day blocks from phaseStart
    let weekNum = 1;
    let blockStartMs = phaseStartMs;

    while (blockStartMs <= phaseEndMs) {
      const blockEndMs = blockStartMs + msPerWeek - msPerDay; // inclusive end (6 days later)
      const effectiveEndMs = Math.min(blockEndMs, phaseEndMs);
      const weekStartStr = toDateStr(new Date(blockStartMs));
      const weekEndStr = toDateStr(new Date(effectiveEndMs));

      // Skip if this block hasn't started yet relative to today
      if (weekStartStr > todayStr) break;

      const isInProgress = !phase.endDate && effectiveEndMs >= new Date(todayStr + "T00:00:00Z").getTime();

      const label = `${new Date(blockStartMs).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })} – ${new Date(effectiveEndMs).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })}`;

      allPeriods.push({
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        label,
        isInProgress,
        weekNumber: weekNum,
        phaseLabel: phase.label,
      });

      weekNum++;
      blockStartMs += msPerWeek;
    }
  }

  // Return newest-first
  return allPeriods.reverse();
}

function avg(vals: (number | null | undefined)[]): number | null {
  const valid = vals.filter((v): v is number => v != null && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function sum(vals: (number | null | undefined)[]): number | null {
  const valid = vals.filter((v): v is number => v != null && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0);
}

function skinfoldTotal(m: Record<string, any>): number | null {
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

export const progressRouter = router({
  weeklyReview: protectedProcedure
    .input(z.object({ clientId: z.number(), tzOffsetMinutes: z.number().optional().default(0) }))
    .query(async ({ input }) => {
      const { clientId, tzOffsetMinutes } = input;

      const [profile, logs, meas, sessions] = await Promise.all([
        db.getClientProfile(clientId),
        db.getDailyLogs(clientId, 9999),
        db.getMeasurements(clientId),
        db.listWorkoutSessions(clientId),
      ]);

      if (!profile) {
        return { weeks: [] };
      }

      // Fetch phases for this client (oldest-first)
      const dbConn = await getDb();
      let phases: Array<{ startDate: string; endDate: string | null; label: string }> = [];
      if (dbConn) {
        const rows = await dbConn
          .select()
          .from(clientPhases)
          .where(eq(clientPhases.clientId, clientId))
          .orderBy(asc(clientPhases.startDate));
        phases = rows.map((r) => ({
          label: r.label,
          startDate: r.startDate instanceof Date ? r.startDate.toISOString().slice(0, 10) : String(r.startDate),
          endDate: r.endDate == null ? null : r.endDate instanceof Date ? r.endDate.toISOString().slice(0, 10) : String(r.endDate),
        }));
      }

      const today = new Date();
      let periods: Array<{ weekStart: string; weekEnd: string; label: string; isInProgress: boolean; weekNumber: number; phaseLabel?: string }>;

      // Use phase-based weeks if any phases have already started; otherwise fall back to check-in-day anchoring
      const localMs = today.getTime() + tzOffsetMinutes * 60 * 1000;
      const localToday = new Date(localMs);
      const todayStr = toDateStr(new Date(Date.UTC(localToday.getUTCFullYear(), localToday.getUTCMonth(), localToday.getUTCDate())));
      const startedPhases = phases.filter(p => p.startDate <= todayStr);

      if (startedPhases.length > 0) {
        periods = buildPhaseWeekPeriods(phases, today, tzOffsetMinutes);
      } else if (profile.checkInDay && profile.startDate) {
        // No phases started yet — fall back to check-in-day anchored weeks (no phaseLabel)
        const startDateStr = typeof profile.startDate === "string" ? profile.startDate : toDateStr(profile.startDate as Date);
        periods = buildWeekPeriods(profile.checkInDay, startDateStr, today, 52, tzOffsetMinutes);
      } else {
        return { weeks: [] };
      }

      // Build weeks newest-first; we need the next item (older week) for deltas
      const rawWeeks = periods.map((period) => {
        // Filter data to this period
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
        const avgSkinfold = periodMeas.length > 0
          ? avg(periodMeas.map((m) => skinfoldTotal(m)))
          : null;

        // Training — sessions logged only (no adherence %)
        const sessionsCompleted = periodSessions.length;

        // Nutrition
        const totalOffPlan = sum(periodLogs.map((l) => l.offPlanMeals));
        const avgCaffeine = avg(periodLogs.map((l) => l.caffeineServings));

        // Recovery
        const avgHunger = avg(periodLogs.map((l) => l.hungerLevel));
        const avgSleepQuality = avg(periodLogs.map((l) => l.sleepQuality));
        const avgStress = avg(periodLogs.map((l) => (l as any).stressLevel));
        const avgSleepHours = avg(periodLogs.map((l) => l.sleepHours));

        // Activity
        const avgSteps = avg(periodLogs.map((l) => l.stepsCount));
        const stepGoal = profile.stepGoal ?? null;
        const totalLissMinutes = periodLogs.reduce((sum, l) => sum + ((l as any).lissMinutes ?? 0), 0);
        const lissSessionsPerWeek = (profile as any).lissSessionsPerWeek ?? null;
        const lissMinutesPerSession = (profile as any).lissMinutesPerSession ?? null;
        const lissTarget = (lissSessionsPerWeek != null && lissMinutesPerSession != null)
          ? lissSessionsPerWeek * lissMinutesPerSession
          : null;

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
          umbilical: avg([m.umbilical1, m.umbilical2, m.umbilical3, m.umbilical4, m.umbilical5]),
          suprailiac: avg([m.suprailiac1, m.suprailiac2, m.suprailiac3, m.suprailiac4, m.suprailiac5]),
          calf: avg([m.calf1, m.calf2, m.calf3, m.calf4, m.calf5]),
          thigh: avg([m.thigh1, m.thigh2, m.thigh3, m.thigh4, m.thigh5]),
          totalSkinfold: skinfoldTotal(m),
          // raw readings for drill-down
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
          weekNumber: period.weekNumber,
          phaseLabel: (period as any).phaseLabel ?? null,
          daysLogged: periodLogs.length,
          // Body composition
          avgWeight,
          avgWaist,
          avgSkinfold,
          // Expanded detail
          weighIns,
          measurementEntries,
          // Training
          sessionsCompleted,
          // Nutrition
          totalOffPlan,
          avgCaffeine,
          // Recovery
          avgHunger,
          avgSleepQuality,
          avgSleepHours,
          avgStress,
          // Activity
          avgSteps,
          stepGoal,
          totalLissMinutes,
          lissTarget,
          lissSessionsPerWeek,
          lissMinutesPerSession,
        };
      });

      // Compute avgWeightPct: % change vs previous week's avgWeight
      // rawWeeks[0] = newest, rawWeeks[1] = one week older, etc.
      const weeks = rawWeeks.map((w, idx) => {
        const prev = rawWeeks[idx + 1] ?? null;
        let avgWeightPct: number | null = null;
        if (w.avgWeight != null && prev?.avgWeight != null && prev.avgWeight !== 0) {
          avgWeightPct = parseFloat(((w.avgWeight - prev.avgWeight) / prev.avgWeight * 100).toFixed(2));
        }
        return { ...w, avgWeightPct };
      });

      return { weeks };
    }),
});
