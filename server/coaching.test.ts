import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  getDailyLogs: vi.fn().mockResolvedValue([]),
  getMeasurements: vi.fn().mockResolvedValue([]),
  getMealPlan: vi.fn().mockResolvedValue(null),
  getShoppingItems: vi.fn().mockResolvedValue([]),
  getTrainingProgram: vi.fn().mockResolvedValue(null),
  getMesoCycles: vi.fn().mockResolvedValue([]),
  getMesoSessions: vi.fn().mockResolvedValue([]),
  getTimelineMilestones: vi.fn().mockResolvedValue([]),
  getWeeklyCheckIns: vi.fn().mockResolvedValue([]),
  getCoachingNotes: vi.fn().mockResolvedValue([]),
  addCoachingNote: vi.fn().mockResolvedValue(undefined),
  deleteCoachingNote: vi.fn().mockResolvedValue(undefined),
  updateCoachingNote: vi.fn().mockResolvedValue(undefined),
  getClientProfile: vi.fn().mockResolvedValue(null),
  getAllUsers: vi.fn().mockResolvedValue([]),
  getClientProfileById: vi.fn().mockResolvedValue(null),
  getTrainingProgramForClient: vi.fn().mockResolvedValue(null),
  getMealPlanForClient: vi.fn().mockResolvedValue(null),
  getDailyLogsForClient: vi.fn().mockResolvedValue([]),
  getMeasurementsForClient: vi.fn().mockResolvedValue([]),
  getCheckInsForClient: vi.fn().mockResolvedValue([]),
}));

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
  it("list returns empty array when no check-ins", async () => {
    const caller = appRouter.createCaller(createUserContext("user"));
    const result = await caller.checkIn.list();
    expect(Array.isArray(result)).toBe(true);
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
