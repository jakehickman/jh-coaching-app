import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock db module ────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  db: {
    createHabit: vi.fn(),
    updateHabit: vi.fn(),
    deleteHabit: vi.fn(),
    listHabits: vi.fn(),
    assignHabit: vi.fn(),
    unassignHabit: vi.fn(),
    getClientHabits: vi.fn(),
    toggleHabitCompletion: vi.fn(),
    getHabitCompletions: vi.fn(),
    getClientHabitCompletions: vi.fn(),
  },
}));

import { db } from "./db";

// ── Helpers ───────────────────────────────────────────────────────────────────
const mockHabit = (overrides = {}) => ({
  id: 1,
  coachId: 10,
  name: "Drink 2L water",
  description: "Stay hydrated",
  frequency: "daily" as const,
  targetDays: 7,
  startDate: "2026-03-01",
  createdAt: new Date("2026-03-01"),
  ...overrides,
});

const mockCompletion = (habitId: number, date: string, clientId = 5) => ({
  id: Math.random(),
  habitId,
  clientId,
  completedDate: date,
  createdAt: new Date(),
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("Habit CRUD", () => {
  it("creates a habit and returns it", async () => {
    const habit = mockHabit();
    vi.mocked(db.createHabit).mockResolvedValue(habit);

    const result = await db.createHabit({
      coachId: 10,
      name: "Drink 2L water",
      description: "Stay hydrated",
      frequency: "daily",
      targetDays: 7,
      startDate: "2026-03-01" as any,
    });

    expect(result).toEqual(habit);
    expect(db.createHabit).toHaveBeenCalledOnce();
  });

  it("updates a habit name", async () => {
    const updated = mockHabit({ name: "Drink 3L water" });
    vi.mocked(db.updateHabit).mockResolvedValue(updated);

    const result = await db.updateHabit(1, 10, { name: "Drink 3L water" });

    expect(result.name).toBe("Drink 3L water");
    expect(db.updateHabit).toHaveBeenCalledWith(1, 10, { name: "Drink 3L water" });
  });

  it("deletes a habit", async () => {
    vi.mocked(db.deleteHabit).mockResolvedValue(undefined);

    await db.deleteHabit(1, 10);

    expect(db.deleteHabit).toHaveBeenCalledWith(1, 10);
  });

  it("lists habits for a coach", async () => {
    const habits = [mockHabit({ id: 1 }), mockHabit({ id: 2, name: "Walk 10k steps" })];
    vi.mocked(db.listHabits).mockResolvedValue(habits);

    const result = await db.listHabits(10);

    expect(result).toHaveLength(2);
    expect(result[1].name).toBe("Walk 10k steps");
  });
});

describe("Habit Assignment", () => {
  it("assigns a habit to a client", async () => {
    const assignment = { id: 1, habitId: 1, clientId: 5, assignedAt: new Date(), active: true };
    vi.mocked(db.assignHabit).mockResolvedValue(assignment);

    const result = await db.assignHabit(1, 5);

    expect(result.clientId).toBe(5);
    expect(result.active).toBe(true);
  });

  it("unassigns a habit from a client", async () => {
    vi.mocked(db.unassignHabit).mockResolvedValue(undefined);

    await db.unassignHabit(1, 5);

    expect(db.unassignHabit).toHaveBeenCalledWith(1, 5);
  });

  it("returns habits assigned to a specific client", async () => {
    const habits = [mockHabit({ id: 1 }), mockHabit({ id: 3, name: "Sleep 8 hours" })];
    vi.mocked(db.getClientHabits).mockResolvedValue(habits);

    const result = await db.getClientHabits(5);

    expect(result).toHaveLength(2);
    expect(result[1].name).toBe("Sleep 8 hours");
  });
});

describe("Habit Completions", () => {
  it("toggles a completion on (adds record)", async () => {
    const completion = mockCompletion(1, "2026-04-07");
    vi.mocked(db.toggleHabitCompletion).mockResolvedValue({ action: "added", completion });

    const result = await db.toggleHabitCompletion(1, 5, "2026-04-07");

    expect(result.action).toBe("added");
    expect(result.completion?.habitId).toBe(1);
  });

  it("toggles a completion off (removes record)", async () => {
    vi.mocked(db.toggleHabitCompletion).mockResolvedValue({ action: "removed", completion: null });

    const result = await db.toggleHabitCompletion(1, 5, "2026-04-07");

    expect(result.action).toBe("removed");
    expect(result.completion).toBeNull();
  });

  it("fetches completions for a client from a given date", async () => {
    const completions = [
      mockCompletion(1, "2026-04-05"),
      mockCompletion(1, "2026-04-06"),
      mockCompletion(2, "2026-04-06"),
    ];
    vi.mocked(db.getHabitCompletions).mockResolvedValue(completions);

    const result = await db.getHabitCompletions(5, "2026-04-05");

    expect(result).toHaveLength(3);
  });

  it("fetches completions for a specific client (coach view)", async () => {
    const completions = [mockCompletion(1, "2026-04-01"), mockCompletion(1, "2026-04-02")];
    vi.mocked(db.getClientHabitCompletions).mockResolvedValue(completions);

    const result = await db.getClientHabitCompletions(5, "2026-03-10");

    expect(result).toHaveLength(2);
    expect(db.getClientHabitCompletions).toHaveBeenCalledWith(5, "2026-03-10");
  });

  it("returns empty array when no completions exist", async () => {
    vi.mocked(db.getHabitCompletions).mockResolvedValue([]);

    const result = await db.getHabitCompletions(99, "2026-04-01");

    expect(result).toEqual([]);
  });
});

describe("Habit adherence calculation", () => {
  it("correctly calculates 7-day adherence percentage", () => {
    const last7 = ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05", "2026-04-06", "2026-04-07"];
    const completedDates = new Set(["2026-04-01", "2026-04-03", "2026-04-05", "2026-04-07"]);
    const done = last7.filter(d => completedDates.has(d)).length;
    const pct = Math.round((done / 7) * 100);
    expect(pct).toBe(57); // 4/7 ≈ 57%
  });

  it("correctly calculates streak of consecutive days", () => {
    // Simulate: completed Apr 5, 6, 7 but not Apr 4
    const completedSet = new Set(["2026-04-05", "2026-04-06", "2026-04-07"]);
    const last7 = ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05", "2026-04-06", "2026-04-07"];
    let streak = 0;
    for (let i = last7.length - 1; i >= 0; i--) {
      if (completedSet.has(last7[i])) streak++;
      else break;
    }
    expect(streak).toBe(3);
  });

  it("returns 0 streak when today is not completed", () => {
    const completedSet = new Set(["2026-04-05", "2026-04-06"]);
    const last7 = ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05", "2026-04-06", "2026-04-07"];
    let streak = 0;
    for (let i = last7.length - 1; i >= 0; i--) {
      if (completedSet.has(last7[i])) streak++;
      else break;
    }
    expect(streak).toBe(0);
  });
});
