import { z } from "zod";
import { protectedProcedure } from "../_core/trpc";
import { router } from "../_core/trpc";
import * as db from "../db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeeklyPeriod {
  weekNum: number;
  label: string;
  dateRange: string;
  startIso: string;
  endIso: string;
  isCurrentWeek: boolean;
  avgWeight: number | null;
  weightEntries: number;
  waist: number | null;
  skinfold: number | null;
  trainingAdherence: number | null;
  trainingSessions: number;
  prescribedSessions: number | null;
  offPlanMeals: number;
  avgCaffeine: number | null;
  habitAdherence: number | null;
  avgHunger: number | null;
  avgSleepQuality: number | null;
  avgSleepHours: number | null;
  avgSteps: number | null;
  stepGoal: number | null;
  delta: {
    avgWeight: number | null;
    avgWeightPct: number | null;
    waist: number | null;
    skinfold: number | null;
    trainingAdherence: number | null;
    offPlanMeals: number | null;
    avgCaffeine: number | null;
    habitAdherence: number | null;
    avgHunger: number | null;
    avgSleepQuality: number | null;
    avgSleepHours: number | null;
    avgSteps: number | null;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_NAME_TO_DOW: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

function msToIso(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function formatDateRange(startIso: string, endIso: string): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const s = new Date(startIso + "T00:00:00Z");
  const e = new Date(endIso + "T00:00:00Z");
  return `${s.getUTCDate()} ${months[s.getUTCMonth()]} – ${e.getUTCDate()} ${months[e.getUTCMonth()]}`;
}

function numAvg(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => v != null);
  if (!nums.length) return null;
  return parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
}

function skinfoldAvg(m: Record<string, unknown>): number | null {
  const sites = ["umbilical", "suprailiac", "calf", "thigh"];
  const readings: number[] = [];
  for (const site of sites) {
    for (let i = 1; i <= 5; i++) {
      const v = m[`${site}${i}`];
      if (typeof v === "number") readings.push(v);
    }
  }
  if (!readings.length) return null;
  return parseFloat((readings.reduce((a, b) => a + b, 0) / readings.length).toFixed(1));
}

function diff(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return parseFloat((b - a).toFixed(2));
}

function pctDiff(a: number | null, b: number | null): number | null {
  if (a == null || b == null || a === 0) return null;
  return parseFloat(((b - a) / a * 100).toFixed(1));
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const progressRouter = router({
  weeklyReview: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { clientId } = input;

      const [profile, logsRaw, measurementsRaw, trainingProgram, workoutSessionsRaw, habitsRaw, completionsRaw] = await Promise.all([
        db.getClientProfile(clientId),
        db.getDailyLogs(clientId, 9999),
        db.getMeasurements(clientId),
        db.getTrainingProgram(clientId),
        db.listWorkoutSessions(clientId),
        db.listAssignedHabitsForClient(clientId),
        db.getHabitCompletionsForClient(clientId),
      ]);

      if (!profile) return [] as WeeklyPeriod[];

      const startDate: string = profile.startDate
        ? String(profile.startDate).slice(0, 10)
        : msToIso(Date.now());

      const checkInDay = (profile as any).checkInDay ?? "wednesday";
      const checkInDow = DAY_NAME_TO_DOW[checkInDay.toLowerCase()] ?? 3;
      const stepGoal: number | null = (profile as any).stepGoal ?? null;

      // ── Build date-indexed maps ────────────────────────────────────────────

      const logByDate: Record<string, typeof logsRaw[0]> = {};
      for (const log of logsRaw) {
        const iso = String(log.logDate).slice(0, 10);
        if (iso >= startDate) logByDate[iso] = log;
      }

      const measByDate: Record<string, typeof measurementsRaw[0]> = {};
      for (const m of measurementsRaw) {
        const iso = String(m.measureDate).slice(0, 10);
        if (iso >= startDate) measByDate[iso] = m;
      }

      const sessionByDate: Record<string, boolean> = {};
      for (const s of workoutSessionsRaw) {
        const iso = String(s.sessionDate).slice(0, 10);
        sessionByDate[iso] = true;
      }

      const completionSet = new Set<string>();
      for (const c of completionsRaw) {
        const iso = String(c.completedDate).slice(0, 10);
        completionSet.add(`${c.habitId}:${iso}`);
      }

      // Training: prescribed sessions per 7 days (prorated)
      let trainingDaysPerRotation = 0;
      let rotationLength = 0;
      if (trainingProgram?.schedule) {
        const schedule: string[] = typeof trainingProgram.schedule === "string"
          ? JSON.parse(trainingProgram.schedule as string)
          : (trainingProgram.schedule as string[]);
        rotationLength = schedule.length;
        trainingDaysPerRotation = schedule.filter((s: string) => s !== "off").length;
      }

      // ── Determine week boundaries ─────────────────────────────────────────
      // Same algorithm as ProgressHistoryTable in client/src/pages/coach/shared.tsx:
      // Find first check-in day on or after startDate.
      // Each week ends on a check-in day; next week starts the day after.

      const startMs = new Date(startDate + "T00:00:00Z").getTime();
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const todayMs = new Date(todayIso + "T00:00:00Z").getTime();

      // Find first check-in boundary on or after startDate
      let firstBoundaryMs = startMs;
      while (new Date(firstBoundaryMs).getUTCDay() !== checkInDow) {
        firstBoundaryMs += 86400000;
      }

      // Generate all week periods up to today
      const boundaries: Array<{ startMs: number; endMs: number }> = [];
      let periodStart = startMs;
      let boundaryMs = firstBoundaryMs;

      while (periodStart <= todayMs) {
        const periodEnd = Math.min(boundaryMs, todayMs);
        boundaries.push({ startMs: periodStart, endMs: periodEnd });
        periodStart = boundaryMs + 86400000;
        boundaryMs += 7 * 86400000;
        if (periodStart > todayMs) break;
      }

      if (boundaries.length === 0) return [] as WeeklyPeriod[];

      // ── Compute per-week stats ─────────────────────────────────────────────

      const rawWeeks: WeeklyPeriod[] = boundaries.map(({ startMs: wStart, endMs: wEnd }, idx) => {
        const startIso = msToIso(wStart);
        const endIso = msToIso(wEnd);
        const isCurrentWeek = wEnd >= todayMs;

        const days: string[] = [];
        for (let ms = wStart; ms <= wEnd; ms += 86400000) {
          days.push(msToIso(ms));
        }

        // Weight
        const weights = days.map(d => logByDate[d]?.weight).filter((v): v is number => v != null);
        const avgWeight = weights.length
          ? parseFloat((weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(2))
          : null;

        // Measurements (most recent in week)
        let waist: number | null = null;
        let skinfold: number | null = null;
        for (let i = days.length - 1; i >= 0; i--) {
          const m = measByDate[days[i]];
          if (m) {
            waist = (m as any).waist ?? null;
            skinfold = skinfoldAvg(m as Record<string, unknown>);
            break;
          }
        }

        // Training
        const sessionsCompleted = days.filter(d => sessionByDate[d]).length;
        let prescribed: number | null = null;
        let trainingAdherence: number | null = null;
        if (rotationLength > 0) {
          prescribed = parseFloat(((trainingDaysPerRotation / rotationLength) * days.length).toFixed(1));
          trainingAdherence = prescribed > 0
            ? Math.min(100, Math.round((sessionsCompleted / prescribed) * 100))
            : null;
        }

        // Off-plan meals: sum total count across the week
        const offPlanMeals = days.reduce((sum, d) => {
          const v = logByDate[d]?.offPlanMeals;
          return sum + (typeof v === "number" ? v : 0);
        }, 0);

        // Caffeine
        const caffeineVals = days.map(d => logByDate[d]?.caffeineServings).filter((v): v is number => v != null);
        const avgCaffeine = caffeineVals.length
          ? parseFloat((caffeineVals.reduce((a, b) => a + b, 0) / caffeineVals.length).toFixed(1))
          : null;

        // Habit adherence
        let habitAdherence: number | null = null;
        if (habitsRaw.length > 0) {
          let totalPossible = 0;
          let totalCompleted = 0;
          for (const habit of habitsRaw) {
            const assignedIso = String((habit as any).assignedAt).slice(0, 10);
            for (const d of days) {
              if (d >= assignedIso) {
                totalPossible++;
                if (completionSet.has(`${habit.id}:${d}`)) totalCompleted++;
              }
            }
          }
          habitAdherence = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : null;
        }

        // Recovery
        const hungerVals = days.map(d => logByDate[d]?.hungerLevel).filter((v): v is number => v != null);
        const sleepQVals = days.map(d => logByDate[d]?.sleepQuality).filter((v): v is number => v != null);
        const sleepHVals = days.map(d => logByDate[d]?.sleepHours).filter((v): v is number => v != null);

        // Steps
        const stepsVals = days.map(d => logByDate[d]?.stepsCount).filter((v): v is number => v != null);
        const avgSteps = stepsVals.length
          ? Math.round(stepsVals.reduce((a, b) => a + b, 0) / stepsVals.length)
          : null;

        return {
          weekNum: idx + 1,
          label: `Week ${idx + 1}`,
          dateRange: formatDateRange(startIso, endIso),
          startIso,
          endIso,
          isCurrentWeek,
          avgWeight,
          weightEntries: weights.length,
          waist,
          skinfold,
          trainingAdherence,
          trainingSessions: sessionsCompleted,
          prescribedSessions: prescribed,
          offPlanMeals,
          avgCaffeine,
          habitAdherence,
          avgHunger: numAvg(hungerVals),
          avgSleepQuality: numAvg(sleepQVals),
          avgSleepHours: numAvg(sleepHVals),
          avgSteps,
          stepGoal,
          delta: {
            avgWeight: null,
            avgWeightPct: null,
            waist: null,
            skinfold: null,
            trainingAdherence: null,
            offPlanMeals: null,
            avgCaffeine: null,
            habitAdherence: null,
            avgHunger: null,
            avgSleepQuality: null,
            avgSleepHours: null,
            avgSteps: null,
          },
        };
      });

      // ── Compute deltas ────────────────────────────────────────────────────
      const weeks: WeeklyPeriod[] = rawWeeks.map((w, idx) => {
        const prev = idx > 0 ? rawWeeks[idx - 1] : null;
        return {
          ...w,
          delta: {
            avgWeight: diff(prev?.avgWeight ?? null, w.avgWeight),
            avgWeightPct: pctDiff(prev?.avgWeight ?? null, w.avgWeight),
            waist: diff(prev?.waist ?? null, w.waist),
            skinfold: diff(prev?.skinfold ?? null, w.skinfold),
            trainingAdherence: prev?.trainingAdherence != null && w.trainingAdherence != null
              ? w.trainingAdherence - prev.trainingAdherence : null,
            offPlanMeals: prev != null ? w.offPlanMeals - prev.offPlanMeals : null,
            avgCaffeine: diff(prev?.avgCaffeine ?? null, w.avgCaffeine),
            habitAdherence: prev?.habitAdherence != null && w.habitAdherence != null
              ? w.habitAdherence - prev.habitAdherence : null,
            avgHunger: diff(prev?.avgHunger ?? null, w.avgHunger),
            avgSleepQuality: diff(prev?.avgSleepQuality ?? null, w.avgSleepQuality),
            avgSleepHours: diff(prev?.avgSleepHours ?? null, w.avgSleepHours),
            avgSteps: prev?.avgSteps != null && w.avgSteps != null
              ? w.avgSteps - prev.avgSteps : null,
          },
        };
      });

      // Return newest first
      return weeks.reverse();
    }),
});
