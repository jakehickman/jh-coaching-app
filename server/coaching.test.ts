import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module — names must match current exports in server/db.ts
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  // Auth
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  // Users / clients
  getAllUsers: vi.fn().mockResolvedValue([]),
  getAllClients: vi.fn().mockResolvedValue([]),
  setUserApproved: vi.fn().mockResolvedValue(undefined),
  getPendingApprovalCount: vi.fn().mockResolvedValue(0),
  deleteUser: vi.fn().mockResolvedValue(undefined),
  // Profile
  getClientProfile: vi.fn().mockResolvedValue(null),
  upsertClientProfile: vi.fn().mockResolvedValue(undefined),
  updateClientProfileExtended: vi.fn().mockResolvedValue(undefined),
  // Daily log
  getDailyLogs: vi.fn().mockResolvedValue([]),
  getDailyLogByDate: vi.fn().mockResolvedValue(null),
  upsertDailyLog: vi.fn().mockResolvedValue(undefined),
  deleteDailyLog: vi.fn().mockResolvedValue(undefined),
  // Measurements
  getMeasurements: vi.fn().mockResolvedValue([]),
  addMeasurement: vi.fn().mockResolvedValue(undefined),
  updateMeasurement: vi.fn().mockResolvedValue(undefined),
  deleteMeasurement: vi.fn().mockResolvedValue(undefined),
  // Meal plan
  getMealPlan: vi.fn().mockResolvedValue(null),
  upsertMealPlan: vi.fn().mockResolvedValue(undefined),
  // Shopping
  getShoppingItems: vi.fn().mockResolvedValue([]),
  toggleShoppingItem: vi.fn().mockResolvedValue(undefined),
  addShoppingItem: vi.fn().mockResolvedValue(undefined),
  deleteShoppingItem: vi.fn().mockResolvedValue(undefined),
  // Training program
  getTrainingProgram: vi.fn().mockResolvedValue(null),
  upsertTrainingProgram: vi.fn().mockResolvedValue(undefined),
  listAllTrainingPrograms: vi.fn().mockResolvedValue([]),
  getMesoCycles: vi.fn().mockResolvedValue([]),
  getMesoSessions: vi.fn().mockResolvedValue([]),
  upsertMesoSession: vi.fn().mockResolvedValue(undefined),
  // Timeline
  getTimelineMilestones: vi.fn().mockResolvedValue([]),
  toggleMilestone: vi.fn().mockResolvedValue(undefined),
  // Coaching notes
  getCoachingNotes: vi.fn().mockResolvedValue([]),
  addCoachingNote: vi.fn().mockResolvedValue(undefined),
  deleteCoachingNote: vi.fn().mockResolvedValue(undefined),
  updateCoachingNote: vi.fn().mockResolvedValue(undefined),
  // Exercise library
  listExercises: vi.fn().mockResolvedValue([]),
  upsertExercise: vi.fn().mockResolvedValue(undefined),
  deleteExercise: vi.fn().mockResolvedValue(undefined),
  // Nutrition
  listNutritionFoods: vi.fn().mockResolvedValue([]),
  upsertNutritionFood: vi.fn().mockResolvedValue(undefined),
  deleteNutritionFood: vi.fn().mockResolvedValue(undefined),
  // Workout sessions
  listWorkoutSessions: vi.fn().mockResolvedValue([]),
  saveWorkoutSession: vi.fn().mockResolvedValue(undefined),
  deleteWorkoutSession: vi.fn().mockResolvedValue(undefined),
  // Onboarding
  createOnboardingSubmission: vi.fn().mockResolvedValue(undefined),
  listOnboardingSubmissions: vi.fn().mockResolvedValue([]),
  markOnboardingReviewed: vi.fn().mockResolvedValue(undefined),
  // Habits
  listHabitsByCoach: vi.fn().mockResolvedValue([]),
  createHabit: vi.fn().mockResolvedValue(undefined),
  updateHabit: vi.fn().mockResolvedValue(undefined),
  deleteHabit: vi.fn().mockResolvedValue(undefined),
  getHabitAssignments: vi.fn().mockResolvedValue([]),
  setHabitAssignments: vi.fn().mockResolvedValue(undefined),
  listAssignedHabitsForClient: vi.fn().mockResolvedValue([]),
  toggleHabitCompletion: vi.fn().mockResolvedValue(undefined),
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

beforeEach(() => {
  vi.clearAllMocks();
});

function createUserContext(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 1 : 7,
      openId: role === "admin" ? "admin-user" : "demo-jake-h",
      email: role === "admin" ? "coach@test.com" : "jake@demo.com",
      name: role === "admin" ? "Coach Jake" : "Jake H",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createGuestContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("auth", () => {
  it("me returns null for unauthenticated users", async () => {
    const caller = appRouter.createCaller(createGuestContext());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("me returns user for authenticated users", async () => {
    const caller = appRouter.createCaller(createUserContext("user"));
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Jake H");
    expect(result?.role).toBe("user");
  });

  it("logout clears session cookie", async () => {
    const ctx = createUserContext("user");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});

describe("dailyLog", () => {
  it("list returns empty array when no logs", async () => {
    const caller = appRouter.createCaller(createUserContext("user"));
    const result = await caller.dailyLog.list({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("list requires authentication", async () => {
    const caller = appRouter.createCaller(createGuestContext());
    await expect(caller.dailyLog.list({ limit: 10 })).rejects.toThrow();
  });
});

describe("measurements", () => {
  it("list returns empty array when no measurements", async () => {
    const caller = appRouter.createCaller(createUserContext("user"));
    const result = await caller.measurements.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("list requires authentication", async () => {
    const caller = appRouter.createCaller(createGuestContext());
    await expect(caller.measurements.list()).rejects.toThrow();
  });
});

describe("profile", () => {
  it("get returns null when no profile exists", async () => {
    const caller = appRouter.createCaller(createUserContext("user"));
    const result = await caller.profile.get();
    expect(result).toBeNull();
  });

  it("get requires authentication", async () => {
    const caller = appRouter.createCaller(createGuestContext());
    await expect(caller.profile.get()).rejects.toThrow();
  });
});

describe("users (admin)", () => {
  it("list requires admin role", async () => {
    const caller = appRouter.createCaller(createUserContext("user"));
    await expect(caller.users.list()).rejects.toThrow();
  });

  it("list succeeds for admin", async () => {
    const caller = appRouter.createCaller(createUserContext("admin"));
    const result = await caller.users.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("shopping", () => {
  it("list returns empty array when no items", async () => {
    const caller = appRouter.createCaller(createUserContext("user"));
    const result = await caller.shopping.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("timeline", () => {
  it("list returns empty array when no milestones", async () => {
    const caller = appRouter.createCaller(createUserContext("user"));
    const result = await caller.timeline.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("checkIn", () => {
  it("myList returns empty array when no check-ins", async () => {
    const caller = appRouter.createCaller(createUserContext("user"));
    const result = await caller.checkIn.myList();
    expect(Array.isArray(result)).toBe(true);
  });

  it("submit accepts current diet execution fields", async () => {
    const caller = appRouter.createCaller(createUserContext("user"));
    const result = await caller.checkIn.submit({
      weekStartDate: "2026-04-07",
      dietWeighedFoods: "every_meal",
      dietMealPrepAccuracy: "most_meals",
      dietExtrasFrequency: "never",
    });
    expect(result).toBeTruthy();
  });

  it("submit rejects invalid diet execution enum values", async () => {
    const caller = appRouter.createCaller(createUserContext("user"));
    await expect(
      caller.checkIn.submit({
        weekStartDate: "2026-04-07",
        dietWeighedFoods: "invalid_value" as any,
      })
    ).rejects.toThrow();
  });

  it("submit requires authentication", async () => {
    const caller = appRouter.createCaller(createGuestContext());
    await expect(
      caller.checkIn.submit({ weekStartDate: "2026-04-07" })
    ).rejects.toThrow();
  });
});

describe("notes (coach)", () => {
  it("list requires admin role", async () => {
    const caller = appRouter.createCaller(createUserContext("user"));
    await expect(caller.notes.list({ clientId: 7 })).rejects.toThrow();
  });

  it("list succeeds for admin", async () => {
    const caller = appRouter.createCaller(createUserContext("admin"));
    const result = await caller.notes.list({ clientId: 7 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("update requires admin role", async () => {
    const caller = appRouter.createCaller(createUserContext("user"));
    await expect(caller.notes.update({ id: 1, content: "edited" })).rejects.toThrow();
  });

  it("update succeeds for admin", async () => {
    const caller = appRouter.createCaller(createUserContext("admin"));
    await expect(caller.notes.update({ id: 1, content: "edited content", category: "Training" })).resolves.not.toThrow();
  });

  it("delete requires admin role", async () => {
    const caller = appRouter.createCaller(createUserContext("user"));
    await expect(caller.notes.delete({ id: 1 })).rejects.toThrow();
  });

  it("delete succeeds for admin", async () => {
    const caller = appRouter.createCaller(createUserContext("admin"));
    await expect(caller.notes.delete({ id: 1 })).resolves.not.toThrow();
  });
});
