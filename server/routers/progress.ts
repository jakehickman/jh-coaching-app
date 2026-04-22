import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

const DAY_NAME_TO_DOW: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

/** Return the Monday-aligned ISO date string for a given Date */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Given a check-in day name (e.g. "wednesday") and a start date,
 * compute the first due date (first occurrence of that weekday AFTER start date,
 * or +7 if start date falls on that weekday), then generate weekly period
 * boundaries going backwards from today.
 *
 * Each period: { weekStart: string, weekEnd: string, label: string }
 * weekEnd = the check-in day (inclusive end of the period)
 * weekStart = weekEnd - 6 days
 */
function buildWeekPeriods(
  checkInDay: string,
  startDate: string,
  today: Date,
  maxWeeks = 52
): Array<{ weekStart: string; weekEnd: string; label: string; isInProgress: boolean }> {
  const dow = DAY_NAME_TO_DOW[checkInDay.toLowerCase()] ?? 1;
  const start = new Date(startDate + "T00:00:00Z");

  // Find first due date: first occurrence of dow AFTER start (not on start)
  const startDow = start.getUTCDay();
  let daysUntilFirst = (dow - startDow + 7) % 7;
  if (daysUntilFirst === 0) daysUntilFirst = 7; // same weekday → next week
  const firstDue = new Date(start);
  firstDue.setUTCDate(start.getUTCDate() + daysUntilFirst);

  // Find the most recent past due date (≤ today)
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const firstDueMs = firstDue.getTime();

  if (firstDueMs > todayMs) return []; // no periods yet

  // How many full 7-day periods since firstDue?
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceFirst = Math.floor((todayMs - firstDueMs) / msPerWeek);
  const latestDueMs = firstDueMs + weeksSinceFirst * msPerWeek;

  const periods: Array<{ weekStart: string; weekEnd: string; label: string; isInProgress: boolean }> = [];

  for (let i = 0; i < maxWeeks; i++) {
    const weekEndMs = latestDueMs - i * msPerWeek;
    if (weekEndMs < firstDueMs) break;

    const weekEnd = new Date(weekEndMs);
    const weekStart = new Date(weekEndMs - 6 * 24 * 60 * 60 * 1000);
    const isInProgress = i === 0 && weekEndMs > todayMs;

    const label = `${weekStart.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })} – ${weekEnd.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })}`;

    periods.push({
      weekStart: toDateStr(weekStart),
      weekEnd: toDateStr(weekEnd),
      label,
      isInProgress,
    });
  }

  return periods;
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
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { clientId } = input;

      const [profile, logs, meas, sessions, habits, completions] = await Promise.all([
        db.getClientProfile(clientId),
        db.getDailyLogs(clientId, 9999),
        db.getMeasurements(clientId),
        db.listWorkoutSessions(clientId),
        db.listAssignedHabitsForClient(clientId),
        db.getHabitCompletionsForClient(clientId),
      ]);

      if (!profile || !profile.checkInDay || !profile.startDate) {
        return { weeks: [] };
      }

      const today = new Date();
      const startDateStr = typeof profile.startDate === "string" ? profile.startDate : toDateStr(profile.startDate as Date);
      const periods = buildWeekPeriods(profile.checkInDay, startDateStr, today);

      const weeks = periods.map((period) => {
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
        const periodCompletions = completions.filter((c) => {
          const d = typeof c.completedDate === "string"
            ? (c.completedDate as string).slice(0, 10)
            : toDateStr(c.completedDate as Date);
          return d >= period.weekStart && d <= period.weekEnd;
        });

        // Body composition
        const avgWeight = avg(periodLogs.map((l) => l.weight));
        const avgWaist = avg(periodMeas.map((m) => m.waist));
        const avgSkinfold = periodMeas.length > 0
          ? avg(periodMeas.map((m) => skinfoldTotal(m)))
          : null;

        // Training
        const trainedDays = periodLogs.filter((l) => l.trainingCompleted).length;
        const totalDays = periodLogs.length;
        const trainingAdherence = totalDays > 0 ? Math.round((trainedDays / totalDays) * 100) : null;

        // Nutrition / adherence
        const totalOffPlan = sum(periodLogs.map((l) => l.offPlanMeals));
        const avgCaffeine = avg(periodLogs.map((l) => l.caffeineServings));

        // Habits
        const habitAdherence = habits.length > 0 && totalDays > 0
          ? Math.round((periodCompletions.length / (habits.length * totalDays)) * 100)
          : null;

        // Recovery
        const avgHunger = avg(periodLogs.map((l) => l.hungerLevel));
        const avgSleepQuality = avg(periodLogs.map((l) => l.sleepQuality));
        const avgSleepHours = avg(periodLogs.map((l) => l.sleepHours));

        // Activity
        const avgSteps = avg(periodLogs.map((l) => l.stepsCount));
        const stepGoal = profile.stepGoal ?? null;

        // Sessions
        const sessionsCompleted = periodSessions.length;

        return {
          weekStart: period.weekStart,
          weekEnd: period.weekEnd,
          label: period.label,
          isInProgress: period.isInProgress,
          daysLogged: totalDays,
          // Body composition
          avgWeight,
          avgWaist,
          avgSkinfold,
          // Training
          trainingAdherence,
          trainedDays,
          sessionsCompleted,
          // Nutrition
          totalOffPlan,
          avgCaffeine,
          // Habits
          habitAdherence,
          // Recovery
          avgHunger,
          avgSleepQuality,
          avgSleepHours,
          // Activity
          avgSteps,
          stepGoal,
        };
      });

      return { weeks };
    }),
});
