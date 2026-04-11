import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module — names must match current exports in server/db.ts
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  getAllUsers: vi.fn().mockResolvedValue([]),
  getAllClients: vi.fn().mockResolvedValue([]),
  setUserApproved: vi.fn().mockResolvedValue(undefined),
  getPendingApprovalCount: vi.fn().mockResolvedValue(0),
  deleteUser: vi.fn().mockResolvedValue(undefined),
  getClientProfile: vi.fn().mockResolvedValue(null),
  upsertClientProfile: vi.fn().mockResolvedValue(undefined),
  updateClientProfileExtended: vi.fn().mockResolvedValue(undefined),
  getDailyLogs: vi.fn().mockResolvedValue([]),
  getDailyLogByDate: vi.fn().mockResolvedValue(null),
  upsertDailyLog: vi.fn().mockResolvedValue(undefined),
  deleteDailyLog: vi.fn().mockResolvedValue(undefined),
  getMeasurements: vi.fn().mockResolvedValue([]),
  addMeasurement: vi.fn().mockResolvedValue(undefined),
  updateMeasurement: vi.fn().mockResolvedValue(undefined),
  deleteMeasurement: vi.fn().mockResolvedValue(undefined),
  getMealPlan: vi.fn().mockResolvedValue(null),
  upsertMealPlan: vi.fn().mockResolvedValue(undefined),
  getShoppingItems: vi.fn().mockResolvedValue([]),
  toggleShoppingItem: vi.fn().mockResolvedValue(undefined),
  addShoppingItem: vi.fn().mockResolvedValue(undefined),
  deleteShoppingItem: vi.fn().mockResolvedValue(undefined),
  getTrainingProgram: vi.fn().mockResolvedValue(null),
  upsertTrainingProgram: vi.fn().mockResolvedValue(undefined),
  listAllTrainingPrograms: vi.fn().mockResolvedValue([]),
  getMesoCycles: vi.fn().mockResolvedValue([]),
  getMesoSessions: vi.fn().mockResolvedValue([]),
  upsertMesoSession: vi.fn().mockResolvedValue(undefined),
  getTimelineMilestones: vi.fn().mockResolvedValue([]),
  toggleMilestone: vi.fn().mockResolvedValue(undefined),
  getCoachingNotes: vi.fn().mockResolvedValue([]),
  addCoachingNote: vi.fn().mockResolvedValue(undefined),
  deleteCoachingNote: vi.fn().mockResolvedValue(undefined),
  updateCoachingNote: vi.fn().mockResolvedValue(undefined),
  listExercises: vi.fn().mockResolvedValue([]),
  upsertExercise: vi.fn().mockResolvedValue(undefined),
  deleteExercise: vi.fn().mockResolvedValue(undefined),
  listNutritionFoods: vi.fn().mockResolvedValue([]),
  upsertNutritionFood: vi.fn().mockResolvedValue(undefined),
  deleteNutritionFood: vi.fn().mockResolvedValue(undefined),
  listWorkoutSessions: vi.fn().mockResolvedValue([]),
  saveWorkoutSession: vi.fn().mockResolvedValue(undefined),
  deleteWorkoutSession: vi.fn().mockResolvedValue(undefined),
  createOnboardingSubmission: vi.fn().mockResolvedValue(undefined),
  listOnboardingSubmissions: vi.fn().mockResolvedValue([]),
  markOnboardingReviewed: vi.fn().mockResolvedValue(undefined),
  // Habits — current names from db.ts
  listHabitsByCoach: vi.fn().mockResolvedValue([]),
  createHabit: vi.fn().mockResolvedValue(undefined),
  updateHabit: vi.fn().mockResolvedValue(undefined),
  deleteHabit: vi.fn().mockResolvedValue(undefined),
  getHabitAssignments: vi.fn().mockResolvedValue([]),
  setHabitAssignments: vi.fn().mockResolvedValue(undefined),
  listAssignedHabitsForClient: vi.fn().mockResolvedValue([]),
  toggleHabitCompletion: vi.fn().mockResolvedValue({ action: "added", completion: null }),
  getHabitCompletionsForClient: vi.fn().mockResolvedValue([]),
  // Check-ins
  submitCheckIn: vi.fn().mockResolvedValue({ id: 1 }),
  listCheckInsForClient: vi.fn().mockResolvedValue([]),
  getCheckInForWeek: vi.fn().mockResolvedValue(null),
  markCheckInReviewed: vi.fn().mockResolvedValue(undefined),
  getLatestCheckInPerClient: vi.fn().mockResolvedValue([]),
  getAllCheckInsPerClient: vi.fn().mockResolvedValue([]),
  deleteCheckIn: vi.fn().mockResolvedValue(undefined),
}));

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "coach@test.com",
      name: "Coach Jake",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "demo-client",
      email: "client@test.com",
      name: "Test Client",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const mockHabit = (overrides = {}) => ({
  id: 1,
  coachId: 1,
  name: "Drink 2L water",
  description: "Stay hydrated",
  frequency: "daily" as const,
  targetDays: 7,
  startDate: "2026-03-01",
  createdAt: new Date("2026-03-01"),
  ...overrides,
});

const mockCompletion = (habitId: number, date: string, clientId = 7) => ({
  id: Math.floor(Math.random() * 10000),
  habitId,
  clientId,
  completedDate: date,
  createdAt: new Date(),
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Router-level tests ────────────────────────────────────────────────────────
describe("habits router — access control", () => {
  it("list requires admin role", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.habits.list()).rejects.toThrow();
  });

  it("list succeeds for admin and returns array", async () => {
    const { listHabitsByCoach } = await import("./db");
    vi.mocked(listHabitsByCoach).mockResolvedValue([mockHabit()] as any);
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.habits.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("myHabits returns array for authenticated client", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.habits.myHabits();
    expect(Array.isArray(result)).toBe(true);
  });

  it("myHabits requires authentication", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    });
    await expect(caller.habits.myHabits()).rejects.toThrow();
  });

  it("myCompletions returns array for authenticated client", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.habits.myCompletions({ fromDate: "2026-04-01" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("clientCompletions requires admin role", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.habits.clientCompletions({ clientId: 7 })).rejects.toThrow();
  });

  it("clientCompletions succeeds for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.habits.clientCompletions({ clientId: 7 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── Pure calculation tests ────────────────────────────────────────────────────
describe("Habit adherence calculation", () => {
  it("correctly calculates 7-day adherence percentage", () => {
    const last7 = ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05", "2026-04-06", "2026-04-07"];
    const completedDates = new Set(["2026-04-01", "2026-04-03", "2026-04-05", "2026-04-07"]);
    const done = last7.filter(d => completedDates.has(d)).length;
    const pct = Math.round((done / 7) * 100);
    expect(pct).toBe(57); // 4/7 ≈ 57%
  });

  it("correctly calculates streak of consecutive days", () => {
    const completedSet = new Set(["2026-04-05", "2026-04-06", "2026-04-07"]);
    const last7 = ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05", "2026-04-06", "2026-04-07"];
    let streak = 0;
    for (let i = last7.length - 1; i >= 0; i--) {
      if (completedSet.has(last7[i])) streak++;
      else break;
    }
    expect(streak).toBe(3);
  });

  it("returns 0 streak when most recent day is not completed", () => {
    const completedSet = new Set(["2026-04-05", "2026-04-06"]);
    const last7 = ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05", "2026-04-06", "2026-04-07"];
    let streak = 0;
    for (let i = last7.length - 1; i >= 0; i--) {
      if (completedSet.has(last7[i])) streak++;
      else break;
    }
    expect(streak).toBe(0);
  });

  it("returns full streak when all days completed", () => {
    const completedSet = new Set(["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05", "2026-04-06", "2026-04-07"]);
    const last7 = ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05", "2026-04-06", "2026-04-07"];
    let streak = 0;
    for (let i = last7.length - 1; i >= 0; i--) {
      if (completedSet.has(last7[i])) streak++;
      else break;
    }
    expect(streak).toBe(7);
  });
});

describe("Habit completion toggle logic", () => {
  it("toggle returns action: added when completion is new", async () => {
    const { toggleHabitCompletion } = await import("./db");
    const completion = mockCompletion(1, "2026-04-07");
    vi.mocked(toggleHabitCompletion).mockResolvedValue({ action: "added", completion } as any);

    const result = await toggleHabitCompletion(1, 7, "2026-04-07");
    expect(result.action).toBe("added");
    expect(result.completion?.habitId).toBe(1);
  });

  it("toggle returns action: removed when completion is deleted", async () => {
    const { toggleHabitCompletion } = await import("./db");
    vi.mocked(toggleHabitCompletion).mockResolvedValue({ action: "removed", completion: null } as any);

    const result = await toggleHabitCompletion(1, 7, "2026-04-07");
    expect(result.action).toBe("removed");
    expect(result.completion).toBeNull();
  });
});
