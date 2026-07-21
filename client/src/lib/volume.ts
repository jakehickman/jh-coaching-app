import { toUTCDateStr } from "./dates";

// Shared between the client's TrainingTab and the coach's ProgressSection —
// previously duplicated with a subtle date-parsing divergence (one used
// String(date).slice(0,10), which breaks if sessionDate ever arrives as a
// real Date object rather than a string) and a genuinely different
// weekly-average formula. Standardized here on the more robust date
// normalization (toUTCDateStr) and the coach side's calendar-week average
// (divides by weeks elapsed/overlapping the month, including rest weeks,
// with special handling for the current in-progress month).
export const MUSCLE_KEYS_ORDERED = [
  { key: "quads",      label: "Quads" },
  { key: "hams",       label: "Hams" },
  { key: "glutes",     label: "Glute Max" },
  { key: "gluteMed",   label: "Glute Med" },
  { key: "chest",      label: "Chest" },
  { key: "lats",       label: "Lats" },
  { key: "upperBack",  label: "Upper Back" },
  { key: "frontDelts", label: "Front Delts" },
  { key: "sideDelts",  label: "Side Delts" },
  { key: "rearDelts",  label: "Rear Delts" },
  { key: "biceps",     label: "Biceps" },
  { key: "triceps",    label: "Triceps" },
  { key: "calves",     label: "Calves" },
  { key: "abs",        label: "Abs" },
] as const;

export type MKey = typeof MUSCLE_KEYS_ORDERED[number]["key"];

export function computeMonthlyVolume(
  sessions: any[],
  exerciseLib: any[],
  year: number,
  month: number // 0-based
): { totals: Record<MKey, number>; weeklyAvg: Record<MKey, number>; sessionCount: number } {
  const exMap: Record<string, any> = {};
  for (const ex of exerciseLib) exMap[ex.name] = ex;

  const totals: Record<string, number> = {};
  for (const mg of MUSCLE_KEYS_ORDERED) totals[mg.key] = 0;

  const monthSessions = sessions.filter(s => {
    const iso = toUTCDateStr(s.sessionDate);
    const d = new Date(iso + "T12:00:00Z");
    return d.getUTCFullYear() === year && d.getUTCMonth() === month;
  });

  for (const session of monthSessions) {
    for (const ex of (session.exercises as any[])) {
      const libEx = exMap[ex.name];
      if (!libEx) continue;
      // Count only completed/logged sets
      const completedSets = (ex.sets ?? []).filter(
        (st: any) => st.completed || st.weight != null || st.reps != null
      );
      // Rest-pause: activation set = 1, then every 2 mini-sets = 1 extra effective set
      let setCount = 0;
      for (const st of completedSets) {
        if (st.myoReps) {
          const mini = parseInt(st.miniSets || "0") || 0;
          setCount += 1 + Math.floor(mini / 2);
        } else {
          setCount += 1;
        }
      }
      if (setCount === 0) continue;
      // Distribute sets across muscle groups by contribution
      for (const mg of MUSCLE_KEYS_ORDERED) {
        const contrib = (libEx[mg.key] ?? 0) as number;
        if (contrib > 0) {
          totals[mg.key] = (totals[mg.key] ?? 0) + setCount * contrib;
        }
      }
    }
  }

  for (const mg of MUSCLE_KEYS_ORDERED) {
    totals[mg.key] = Math.round(totals[mg.key]);
  }

  // Weekly average denominator: Mon-Sun calendar weeks elapsed/overlapping
  // the month (including weeks with no session), not just weeks that had
  // activity. For the current month, only count weeks up to and including
  // today's week — the rest of the month hasn't happened yet.
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const monFirst = (firstDow + 6) % 7; // days before the first Monday (0=Mon offset)
  let weeksInMonth: number;
  if (isCurrentMonth) {
    const dayOfMonth = today.getDate(); // 1-based
    weeksInMonth = Math.ceil((dayOfMonth + monFirst) / 7);
  } else {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    weeksInMonth = Math.ceil((daysInMonth + monFirst) / 7);
  }

  const weeklyAvg: Record<string, number> = {};
  for (const mg of MUSCLE_KEYS_ORDERED) {
    weeklyAvg[mg.key] = Math.round(totals[mg.key] / weeksInMonth);
  }

  return {
    totals: totals as Record<MKey, number>,
    weeklyAvg: weeklyAvg as Record<MKey, number>,
    sessionCount: monthSessions.length,
  };
}
