import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: {
      cookies: {},
    } as any,
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as any,
  };
  return { ctx };
}

// Mock the db module so we don't need a real database connection
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    updateWorkoutSessionDate: vi.fn().mockResolvedValue(undefined),
  };
});

describe("workoutSessions.updateDate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call updateWorkoutSessionDate with correct args", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { updateWorkoutSessionDate } = await import("./db");

    await caller.workoutSessions.updateDate({ id: 42, sessionDate: "2026-04-15" });

    expect(updateWorkoutSessionDate).toHaveBeenCalledWith(42, 1, "2026-04-15");
  });

  it("should reject if user is not authenticated", async () => {
    const unauthCtx: TrpcContext = {
      user: null,
      req: { cookies: {} } as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
    };
    const caller = appRouter.createCaller(unauthCtx);

    await expect(
      caller.workoutSessions.updateDate({ id: 42, sessionDate: "2026-04-15" })
    ).rejects.toThrow();
  });
});
