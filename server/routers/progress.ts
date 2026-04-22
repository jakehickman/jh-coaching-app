import { z } from "zod";
import { adminProcedure } from "./shared";
import { router } from "../_core/trpc";
import * as db from "../db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeeklyPeriod {
  weekNum: number;          // 1 = oldest, N = most recent
  label: string;            // "Week 1", "Week 2", ...
  dateRange: string;        // "16 Apr – 22 Apr"
  startIso: string;         // "2026-04-16"
  endIso: string;           // "2026-04-22"
  isCurrentWeek: boolean;

  // Body Composition
  avgWeight: number | null;
  waist: number | null;
  skinfold: number | null;
  weightEntries: number;

  // Adherence / Nutrition
  trainingAdherence: number | null;   // 0–100 %
  trainingSessions: number;           // sessions logged
  prescribedSessions: number | null;  // prescribed per rotation (prorated)
  offPlanMeals: number;               // total days with off-plan meal
  avgCaffeine: number | null;         // avg servings/day (logged days)
  habitAdherence: number | null;      // 0–100 % (completions / (habits × 7))

  // Recovery / Wellbeing
  avgHunger: number | null;           // 1–5
  avgSleepQuality: number | null;     // 1–5
  avgSleepHours: number | null;

  // Activity
  avgSteps: number | null;

  // Deltas vs previous period (null if no previous)
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

  // Auto-generated summary
  summary: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_NAME_TO_DOW: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

function isoToMs(iso: string): number {
  return new Date(iso + "T00:00:00Z").getTime();
}

function msToIso(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function formatDateRange(startIso: string, endIso: string): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const s = new Date(startIso + "T00:00:00Z");
  const e = new Date(endIso + "T00:00:00Z");
  const sStr = `${s.getUTCDate()} ${months[s.getUTCMonth()]}`;
  const eStr = `${e.getUTCDate()} ${months[e.getUTCMonth()]}`;
  return `${sStr} – ${eStr}`;
}

function avg(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => v != null);
  if (!nums.length) return null;
  return parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
}

function avgSkinfold(m: any): number | null {
  // Average of all skinfold readings (umbilical, suprailiac, calf, thigh — 5 readings each)
  const sites = ["umbilical", "suprailiac", "calf", "thigh"];
  const readings: number[] = [];
  for (const site of sites) {
    for (let i = 1; i <= 5; i++) {
      const v = m[`${site}${i}`];
      if (v != null) readings.push(v);
    }
  }
  if (!readings.length) return null;
  return parseFloat((readings.reduce((a, b) => a + b, 0) / readings.length).toFixed(1));
}

function buildSummary(w: Omit<WeeklyPeriod, "summary">, prev: Omit<WeeklyPeriod, "summary"> | null): string {
  const parts: string[] = [];

  // Weight
  if (w.avgWeight != null && prev?.avgWeight != null) {
    const diff = parseFloat((w.avgWeight - prev.avgWeight).toFixed(1));
    if (Math.abs(diff) < 0.1) parts.push("Weight stable");
    else parts.push(`Weight ${diff > 0 ? "up" : "down"} ${Math.abs(diff)} kg`);
  }

  // Waist
  if (w.waist != null && prev?.waist != null) {
    const diff = parseFloat((w.waist - prev.waist).toFixed(1));
    if (Math.abs(diff) >= 0.1) parts.push(`Waist ${diff > 0 ? "up" : "down"} ${Math.abs(diff)} cm`);
  }

  // Skinfold
  if (w.skinfold != null && prev?.skinfold != null) {
    const diff = parseFloat((w.skinfold - prev.skinfold).toFixed(1));
    if (Math.abs(diff) >= 0.1) parts.push(`Skinfold ${diff > 0 ? "up" : "down"} ${Math.abs(diff)} mm`);
  }

  // Training adherence
  if (w.trainingAdherence != null) {
    if (w.trainingAdherence === 100) parts.push("Full training adherence");
    else if (w.trainingAdherence >= 80) parts.push("Good training adherence");
    else if (w.trainingAdherence < 50) parts.push("Low training adherence");
  }

  // Habits
  if (w.habitAdherence != null) {
    if (w.habitAdherence === 100) parts.push("All habits completed");
    else if (w.habitAdherence < 50) parts.push("Low habit adherence");
  }

  if (!parts.length) return "";
  return parts.join(", ") + ".";
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const progressRouter = router({
  weeklyReview: adminProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const { clientId } = input;

      // Fetch all data in parallel
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

      const startDate: string = (profile as any).startDate
        ? String((profile as any).startDate).slice(0, 10)
        : msToIso(Date.now());

      const checkInDay = (profile as any).checkInDay ?? "wednesday";
      const checkInDow = DAY_NAME_TO_DOW[checkInDay.toLowerCase()] ?? 3;

      // ── Build date-indexed maps ────────────────────────────────────────────
      const logByDate: Record<string, typeof logsRaw[0]> = {};
      for (const log of logsRaw) {
        const iso = String(log.logDate).slice(0, 10);
        if (iso >= startDate) logByDate[iso] = log;
      }

      // Measurements: keep most recent per date
      const measByDate: Record<string, typeof measurementsRaw[0]> = {};
      for (const m of measurementsRaw) {
        const iso = String(m.measureDate).slice(0, 10);
        if (iso >= startDate) measByDate[iso] = m;
      }

      // Workout sessions: by date
      const sessionByDate: Record<string, boolean> = {};
      for (const s of workoutSessionsRaw) {
        const iso = String(s.sessionDate).slice(0, 10);
        sessionByDate[iso] = true;
      }

      // Habit completions: set of "habitId:date"
      const completionSet = new Set<string>();
      for (const c of completionsRaw) {
        const iso = String(c.completedDate).slice(0, 10);
        completionSet.add(`${c.habitId}:${iso}`);
      }

      // Training program: extract schedule for prescribed sessions per rotation
      let trainingDaysPerRotation = 0;
      let rotationLength = 0;
      if (trainingProgram?.schedule) {
        const schedule: string[] = typeof trainingProgram.schedule === "string"
          ? JSON.parse(trainingProgram.schedule)
          : (trainingProgram.schedule as string[]);
        rotationLength = schedule.length;
        trainingDaysPerRotation = schedule.filter((s: string) => s !== "off").length;
      }

      // ── Determine week boundaries ─────────────────────────────────────────
      // Find first check-in day AFTER start date (if start date is on check-in day, advance 7 days)
      let firstCheckInMs = isoToMs(startDate);
      while (new Date(firstCheckInMs).getUTCDay() !== checkInDow) {
        firstCheckInMs += 86400000;
      }
      // If start date falls exactly on check-in day, advance one full week
      if (msToIso(firstCheckInMs) === startDate) {
        firstCheckInMs += 7 * 86400000;
      }

      const todayMs = isoToMs(msToIso(Date.now()));

      // Generate week boundaries: each week ends on a check-in day
      // Week N: [prevCheckIn+1 ... checkInDay]
      const weekBoundaries: Array<{ startMs: number; endMs: number }> = [];
      let boundaryMs = firstCheckInMs;
      // First week starts from startDate
      weekBoundaries.push({ startMs: isoToMs(startDate), endMs: firstCheckInMs });
      boundaryMs = firstCheckInMs + 86400000; // day after first check-in
      while (boundaryMs <= todayMs) {
        const endMs = boundaryMs + 6 * 86400000;
        weekBoundaries.push({ startMs: boundaryMs, endMs: Math.min(endMs, todayMs) });
        boundaryMs = endMs + 86400000;
      }

      // ── Compute per-week stats ─────────────────────────────────────────────
      const rawWeeks: Array<Omit<WeeklyPeriod, "summary">> = weekBoundaries.map(({ startMs, endMs }, idx) => {
        const startIso = msToIso(startMs);
        const endIso = msToIso(endMs);
        const isCurrentWeek = endMs >= todayMs;

        // Enumerate days in this period
        const days: string[] = [];
        for (let ms = startMs; ms <= endMs; ms += 86400000) {
          days.push(msToIso(ms));
        }

        // Body composition: weight from daily logs
        const weights = days.map(d => logByDate[d]?.weight).filter((v): v is number => v != null);
        const avgWt = weights.length ? parseFloat((weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(2)) : null;

        // Measurements: best (most recent) in this period
        const measInPeriod = days.map(d => measByDate[d]).filter(Boolean);
        const latestMeas = measInPeriod[measInPeriod.length - 1] ?? null;
        const waist = latestMeas?.waist != null ? parseFloat(String(latestMeas.waist)) : null;
        const skinfoldVal = latestMeas ? avgSkinfold(latestMeas) : null;

        // Training adherence: sessions completed / prescribed (prorated)
        const sessionsCompleted = days.filter(d => logByDate[d]?.trainingCompleted).length;
        let prescribed: number | null = null;
        if (rotationLength > 0) {
          prescribed = parseFloat(((trainingDaysPerRotation / rotationLength) * days.length).toFixed(1));
        }
        const trainingAdh = prescribed != null && prescribed > 0
          ? Math.min(100, Math.round((sessionsCompleted / prescribed) * 100))
          : null;

        // Off-plan meals: count days with offPlanMeals > 0 (boolean field)
        const offPlan = days.filter(d => logByDate[d]?.offPlanMeals && (logByDate[d].offPlanMeals as any) > 0).length;

        // Caffeine: average of logged days
        const caffeineVals = days.map(d => logByDate[d]?.caffeineServings).filter((v): v is number => v != null);
        const avgCaff = caffeineVals.length ? parseFloat((caffeineVals.reduce((a, b) => a + b, 0) / caffeineVals.length).toFixed(1)) : null;

        // Habit adherence: completions / (habits × days)
        let habitAdh: number | null = null;
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
          habitAdh = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : null;
        }

        // Recovery
        const hungerVals = days.map(d => logByDate[d]?.hungerLevel).filter((v): v is number => v != null);
        const sleepQVals = days.map(d => logByDate[d]?.sleepQuality).filter((v): v is number => v != null);
        const sleepHVals = days.map(d => logByDate[d]?.sleepHours).filter((v): v is number => v != null);
        const stepsVals = days.map(d => logByDate[d]?.stepsCount).filter((v): v is number => v != null);

        return {
          weekNum: idx + 1,
          label: `Week ${idx + 1}`,
          dateRange: formatDateRange(startIso, endIso),
          startIso,
          endIso,
          isCurrentWeek,
          avgWeight: avgWt,
          waist,
          skinfold: skinfoldVal,
          weightEntries: weights.length,
          trainingAdherence: trainingAdh,
          trainingSessions: sessionsCompleted,
          prescribedSessions: prescribed,
          offPlanMeals: offPlan,
          avgCaffeine: avgCaff,
          habitAdherence: habitAdh,
          avgHunger: avg(hungerVals),
          avgSleepQuality: avg(sleepQVals),
          avgSleepHours: avg(sleepHVals),
          avgSteps: stepsVals.length ? Math.round(stepsVals.reduce((a, b) => a + b, 0) / stepsVals.length) : null,
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

        const delta: WeeklyPeriod["delta"] = {
          avgWeight: prev?.avgWeight != null && w.avgWeight != null
            ? parseFloat((w.avgWeight - prev.avgWeight).toFixed(2)) : null,
          avgWeightPct: prev?.avgWeight != null && w.avgWeight != null && prev.avgWeight !== 0
            ? parseFloat(((w.avgWeight - prev.avgWeight) / prev.avgWeight * 100).toFixed(1)) : null,
          waist: prev?.waist != null && w.waist != null
            ? parseFloat((w.waist - prev.waist).toFixed(1)) : null,
          skinfold: prev?.skinfold != null && w.skinfold != null
            ? parseFloat((w.skinfold - prev.skinfold).toFixed(1)) : null,
          trainingAdherence: prev?.trainingAdherence != null && w.trainingAdherence != null
            ? w.trainingAdherence - prev.trainingAdherence : null,
          offPlanMeals: prev != null ? w.offPlanMeals - prev.offPlanMeals : null,
          avgCaffeine: prev?.avgCaffeine != null && w.avgCaffeine != null
            ? parseFloat((w.avgCaffeine - prev.avgCaffeine).toFixed(1)) : null,
          habitAdherence: prev?.habitAdherence != null && w.habitAdherence != null
            ? w.habitAdherence - prev.habitAdherence : null,
          avgHunger: prev?.avgHunger != null && w.avgHunger != null
            ? parseFloat((w.avgHunger - prev.avgHunger).toFixed(1)) : null,
          avgSleepQuality: prev?.avgSleepQuality != null && w.avgSleepQuality != null
            ? parseFloat((w.avgSleepQuality - prev.avgSleepQuality).toFixed(1)) : null,
          avgSleepHours: prev?.avgSleepHours != null && w.avgSleepHours != null
            ? parseFloat((w.avgSleepHours - prev.avgSleepHours).toFixed(1)) : null,
          avgSteps: prev?.avgSteps != null && w.avgSteps != null
            ? w.avgSteps - prev.avgSteps : null,
        };

        const summary = buildSummary(w, prev);
        return { ...w, delta, summary };
      });

      // Return newest first
      return weeks.reverse();
    }),
});
