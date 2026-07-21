import { describe, it, expect } from "vitest";
import { calcItemMacros, getEffectiveGrams, type MealItem } from "./MealPlansSection";

const chicken = { name: "Chicken breast, lean, raw", calories: 165, protein: 31, carbs: 0, fiber: 0, fat: 3.6 };
const foodDb = [chicken];

function item(overrides: Partial<MealItem> = {}): MealItem {
  return { food: "Chicken breast, lean, raw", qty: "1", servingId: null, servingGrams: 100, servingLabel: "100g", ...overrides };
}

describe("calcItemMacros", () => {
  it("scales macros by qty * servingGrams / 100", () => {
    const result = calcItemMacros(foodDb, item({ qty: "1.5", servingGrams: 100 }));
    // 165 * 1.5 = 247.5 -> rounds to 248
    expect(result.calories).toBe(248);
    expect(result.protein).toBe(47); // 31 * 1.5 = 46.5 -> 47
  });

  it("scales by servingGrams for a non-100g serving (e.g. a 240g cup)", () => {
    const result = calcItemMacros(foodDb, item({ qty: "1", servingGrams: 240 }));
    // 165 * (240/100) = 396
    expect(result.calories).toBe(396);
  });

  it("returns all zeros when food isn't found in the db", () => {
    const result = calcItemMacros(foodDb, item({ food: "Unknown food" }));
    expect(result).toEqual({ calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 });
  });

  it("returns all zeros when qty is empty/zero", () => {
    const result = calcItemMacros(foodDb, item({ qty: "" }));
    expect(result).toEqual({ calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 });
  });

  it("falls back to the legacy grams field when qty is undefined", () => {
    const legacyItem = { food: "Chicken breast, lean, raw", grams: "2", servingId: null, servingGrams: 100, servingLabel: "100g" } as unknown as MealItem;
    const result = calcItemMacros(foodDb, legacyItem);
    expect(result.calories).toBe(330); // 165 * 2
  });
});

describe("getEffectiveGrams", () => {
  it("multiplies qty by servingGrams", () => {
    expect(getEffectiveGrams(item({ qty: "2", servingGrams: 100 }))).toBe(200);
    expect(getEffectiveGrams(item({ qty: "1", servingGrams: 240 }))).toBe(240);
  });

  it("returns 0 for an empty qty", () => {
    expect(getEffectiveGrams(item({ qty: "" }))).toBe(0);
  });
});
