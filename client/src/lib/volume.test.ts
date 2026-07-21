import { describe, it, expect, vi, afterEach } from "vitest";
import { computeMonthlyVolume, MUSCLE_KEYS_ORDERED } from "./volume";

const exerciseLib = [
  { name: "Bench Press", chest: 1, triceps: 0.5, frontDelts: 0.3 },
  { name: "Squat", quads: 1, glutes: 0.5 },
];

function session(sessionDate: string, sets: number) {
  return {
    sessionDate,
    exercises: [
      {
        name: "Bench Press",
        sets: Array.from({ length: sets }, () => ({ completed: true, weight: 60, reps: 8 })),
      },
    ],
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("computeMonthlyVolume", () => {
  it("only counts sessions within the given month/year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z")); // a month after July, so July is fully in the past

    const sessions = [session("2026-07-06", 3), session("2026-06-30", 3), session("2026-08-01", 3)];
    const { sessionCount } = computeMonthlyVolume(sessions, exerciseLib, 2026, 6); // July = month index 6
    expect(sessionCount).toBe(1);
  });

  it("distributes sets across muscle groups by contribution factor", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));

    const sessions = [session("2026-07-06", 4)];
    const { totals } = computeMonthlyVolume(sessions, exerciseLib, 2026, 6);
    expect(totals.chest).toBe(4); // 4 sets * 1.0 contribution
    expect(totals.triceps).toBe(2); // 4 sets * 0.5 contribution
    expect(totals.quads).toBe(0); // Squat never performed
  });

  it("counts rest-pause sets as activation + 1 per 2 mini-sets", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));

    const sessions = [
      {
        sessionDate: "2026-07-06",
        exercises: [
          {
            name: "Bench Press",
            sets: [{ completed: true, myoReps: true, miniSets: "4" }], // 1 activation + floor(4/2) = 3 effective sets
          },
        ],
      },
    ];
    const { totals } = computeMonthlyVolume(sessions, exerciseLib, 2026, 6);
    expect(totals.chest).toBe(3);
  });

  it("divides weekly average by calendar weeks elapsed, not just weeks with a session", () => {
    // Fix "today" inside July 2026 so isCurrentMonth logic is exercised deterministically.
    // July 1 2026 is a Wednesday; the first Monday is July 6. July 21 falls in the 3rd Mon-Sun week.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T12:00:00Z"));

    // One session in week 1 only (a single Mon-Sun week with activity), but 3 calendar
    // weeks have elapsed by July 21 — average should divide by 3, not by 1.
    const sessions = [session("2026-07-02", 3)]; // Thursday of the pre-first-Monday partial week
    const { totals, weeklyAvg } = computeMonthlyVolume(sessions, exerciseLib, 2026, 6);
    expect(totals.chest).toBe(3);
    expect(weeklyAvg.chest).toBe(1); // round(3 / 3 weeks elapsed) = 1
  });

  it("includes every muscle key with a zero default", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));

    const { totals } = computeMonthlyVolume([], exerciseLib, 2026, 6);
    for (const mg of MUSCLE_KEYS_ORDERED) {
      expect(totals[mg.key]).toBe(0);
    }
  });
});
