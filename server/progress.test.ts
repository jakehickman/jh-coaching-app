import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module — names must match current exports in server/db.ts
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  getClientProfile: vi.fn().mockResolvedValue(null),
  getDailyLogs: vi.fn().mockResolvedValue([]),
  getMeasurements: vi.fn().mockResolvedValue([]),
  listWorkoutSessions: vi.fn().mockResolvedValue([]),
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("progress router — access control", () => {
  it("weeklyReview requires admin role (regression test for IDOR)", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(
      caller.progress.weeklyReview({ clientId: 999 })
    ).rejects.toThrow();
  });

  it("weeklyReview rejects unauthenticated callers", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    });
    await expect(
      caller.progress.weeklyReview({ clientId: 7 })
    ).rejects.toThrow();
  });

  it("weeklyReview succeeds for admin and returns weeks array", async () => {
    const { getClientProfile } = await import("./db");
    vi.mocked(getClientProfile).mockResolvedValue({
      id: 1,
      userId: 7,
      coachId: 1,
      startDate: "2026-01-01",
      stepGoal: 8000,
    } as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.progress.weeklyReview({ clientId: 7 });
    expect(Array.isArray(result.weeks)).toBe(true);
  });
});
