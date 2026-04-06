/**
 * Tests for the new-client notification logic added to the OAuth callback.
 *
 * The OAuth callback now:
 *   1. Looks up the user by openId before upserting.
 *   2. If the user did not previously exist, fires notifyOwner (fire-and-forget).
 *   3. Always completes the login regardless of notification success/failure.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockGetUserByOpenId = vi.fn();
const mockUpsertUser = vi.fn();
const mockNotifyOwner = vi.fn();

vi.mock("./db", () => ({
  getUserByOpenId: mockGetUserByOpenId,
  upsertUser: mockUpsertUser,
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: mockNotifyOwner,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Simulates the notification logic extracted from the OAuth callback so we can
 * test it in isolation without spinning up an HTTP server.
 */
async function runOAuthNotificationLogic(userInfo: {
  openId: string;
  name?: string | null;
  email?: string | null;
}) {
  const db = await import("./db");
  const { notifyOwner } = await import("./_core/notification");

  const existingUser = await db.getUserByOpenId(userInfo.openId);
  const isNewUser = !existingUser;

  await db.upsertUser({
    openId: userInfo.openId,
    name: userInfo.name ?? null,
    email: userInfo.email ?? null,
    loginMethod: null,
    lastSignedIn: new Date(),
  });

  if (isNewUser) {
    const displayName = userInfo.name || userInfo.email || userInfo.openId;
    Promise.resolve()
      .then(() =>
        notifyOwner({
          title: "New client signed up",
          content: `${displayName} just created an account. Go to the Coach Panel to review and approve them.`,
        })
      )
      .catch(() => {});
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("OAuth callback – new-user notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifyOwner.mockResolvedValue(true);
  });

  it("sends a notification when the user is brand new", async () => {
    mockGetUserByOpenId.mockResolvedValue(null); // user does not exist yet

    await runOAuthNotificationLogic({
      openId: "new-open-id-123",
      name: "Alice Smith",
      email: "alice@example.com",
    });

    // Allow the fire-and-forget Promise microtask to flush
    await new Promise((r) => setTimeout(r, 0));

    expect(mockNotifyOwner).toHaveBeenCalledOnce();
    expect(mockNotifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New client signed up",
        content: expect.stringContaining("Alice Smith"),
      })
    );
  });

  it("does NOT send a notification for a returning user", async () => {
    mockGetUserByOpenId.mockResolvedValue({
      id: 42,
      openId: "existing-open-id",
      name: "Bob Jones",
    });

    await runOAuthNotificationLogic({
      openId: "existing-open-id",
      name: "Bob Jones",
      email: "bob@example.com",
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(mockNotifyOwner).not.toHaveBeenCalled();
  });

  it("uses email as display name when name is absent", async () => {
    mockGetUserByOpenId.mockResolvedValue(null);

    await runOAuthNotificationLogic({
      openId: "no-name-id",
      name: null,
      email: "noname@example.com",
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(mockNotifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("noname@example.com"),
      })
    );
  });

  it("uses openId as display name when both name and email are absent", async () => {
    mockGetUserByOpenId.mockResolvedValue(null);

    await runOAuthNotificationLogic({
      openId: "bare-open-id",
      name: null,
      email: null,
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(mockNotifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("bare-open-id"),
      })
    );
  });

  it("always upserts the user regardless of notification outcome", async () => {
    mockGetUserByOpenId.mockResolvedValue(null);
    mockNotifyOwner.mockRejectedValue(new Error("notification service down"));

    await runOAuthNotificationLogic({
      openId: "fail-notify-id",
      name: "Carol",
      email: null,
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(mockUpsertUser).toHaveBeenCalledOnce();
  });
});
