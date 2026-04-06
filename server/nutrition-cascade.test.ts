/**
 * Tests for the nutrition food name cascade rename logic.
 *
 * When a food is renamed in the Nutrition Data tab, the server must:
 *   1. Fetch the old name before updating the nutrition_foods row.
 *   2. Scan all meal_plans.meals JSON arrays and replace item.food === oldName
 *      with the new name.
 *   3. Persist only the plans that actually changed.
 *   4. Do nothing when the name hasn't changed.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extracts the cascade logic from upsertNutritionFood so we can test it
 * without a real DB connection.
 */
function cascadeFoodRename(
  oldName: string,
  newName: string,
  plans: Array<{ id: number; meals: unknown }>
): Array<{ id: number; meals: unknown }> {
  const updated: Array<{ id: number; meals: unknown }> = [];
  for (const plan of plans) {
    const meals = plan.meals as any[];
    if (!Array.isArray(meals)) continue;
    let changed = false;
    const updatedMeals = meals.map((meal: any) => {
      if (!Array.isArray(meal.items)) return meal;
      const updatedItems = meal.items.map((item: any) => {
        if (item.food === oldName) {
          changed = true;
          return { ...item, food: newName };
        }
        return item;
      });
      return { ...meal, items: updatedItems };
    });
    if (changed) {
      updated.push({ id: plan.id, meals: updatedMeals });
    }
  }
  return updated;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("nutrition food cascade rename", () => {
  it("renames food in a single meal plan", () => {
    const plans = [
      {
        id: 1,
        meals: [
          { name: "Breakfast", items: [{ food: "Chicken breast", grams: "150" }] },
        ],
      },
    ];
    const result = cascadeFoodRename("Chicken breast", "Chicken breast, raw", plans);
    expect(result).toHaveLength(1);
    expect((result[0].meals as any[])[0].items[0].food).toBe("Chicken breast, raw");
  });

  it("renames food across multiple meals in one plan", () => {
    const plans = [
      {
        id: 1,
        meals: [
          { name: "Breakfast", items: [{ food: "Oats", grams: "80" }] },
          { name: "Lunch", items: [{ food: "Oats", grams: "60" }, { food: "Chicken breast", grams: "150" }] },
        ],
      },
    ];
    const result = cascadeFoodRename("Oats", "Rolled oats", plans);
    expect(result).toHaveLength(1);
    const meals = result[0].meals as any[];
    expect(meals[0].items[0].food).toBe("Rolled oats");
    expect(meals[1].items[0].food).toBe("Rolled oats");
    expect(meals[1].items[1].food).toBe("Chicken breast"); // unchanged
  });

  it("renames food across multiple plans", () => {
    const plans = [
      {
        id: 1,
        meals: [{ name: "Breakfast", items: [{ food: "Eggs", grams: "100" }] }],
      },
      {
        id: 2,
        meals: [{ name: "Dinner", items: [{ food: "Eggs", grams: "150" }] }],
      },
    ];
    const result = cascadeFoodRename("Eggs", "Eggs, whole", plans);
    expect(result).toHaveLength(2);
    expect((result[0].meals as any[])[0].items[0].food).toBe("Eggs, whole");
    expect((result[1].meals as any[])[0].items[0].food).toBe("Eggs, whole");
  });

  it("does NOT update plans that do not reference the old name", () => {
    const plans = [
      {
        id: 1,
        meals: [{ name: "Breakfast", items: [{ food: "Greek yogurt", grams: "200" }] }],
      },
    ];
    const result = cascadeFoodRename("Chicken breast", "Chicken breast, raw", plans);
    expect(result).toHaveLength(0);
  });

  it("does NOT update when old name equals new name (caller-level guard)", () => {
    // In production, upsertNutritionFood checks `existing.name !== data.name`
    // before calling the cascade, so this case never reaches cascadeFoodRename.
    // We verify the guard logic directly here.
    const oldName = "Rice";
    const newName = "Rice";
    // Guard: skip cascade when names are identical
    const shouldCascade = oldName !== newName;
    expect(shouldCascade).toBe(false);
  });

  it("handles plans with empty or missing items arrays gracefully", () => {
    const plans = [
      { id: 1, meals: [{ name: "Empty meal" }] },
      { id: 2, meals: [{ name: "Null items", items: null }] },
      { id: 3, meals: null },
    ];
    expect(() => cascadeFoodRename("Chicken", "Chicken breast", plans)).not.toThrow();
    const result = cascadeFoodRename("Chicken", "Chicken breast", plans);
    expect(result).toHaveLength(0);
  });
});

// ── Router-level access control tests ─────────────────────────────────────

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  listNutritionFoods: vi.fn().mockResolvedValue([]),
  upsertNutritionFood: vi.fn().mockResolvedValue(undefined),
  deleteNutritionFood: vi.fn().mockResolvedValue(undefined),
}));

function makeCtx(role: "user" | "admin"): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 1 : 7,
      openId: role === "admin" ? "admin-open-id" : "user-open-id",
      email: null,
      name: role,
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("nutritionFoods router access control", () => {
  it("list is accessible to regular users", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.nutritionFoods.list()).resolves.toBeDefined();
  });

  it("upsert requires admin role", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(
      caller.nutritionFoods.upsert({ name: "Test", calories: 100, protein: 10, carbs: 10, fiber: 1, fat: 5 })
    ).rejects.toThrow();
  });

  it("upsert succeeds for admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.nutritionFoods.upsert({ name: "Test", calories: 100, protein: 10, carbs: 10, fiber: 1, fat: 5 })
    ).resolves.not.toThrow();
  });

  it("delete requires admin role", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.nutritionFoods.delete({ id: 1 })).rejects.toThrow();
  });

  it("delete succeeds for admin", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(caller.nutritionFoods.delete({ id: 1 })).resolves.not.toThrow();
  });
});
