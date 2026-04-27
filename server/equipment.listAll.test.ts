import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getAllEquipmentPresets: vi.fn(),
  getEquipmentPresets: vi.fn(),
  upsertEquipmentPreset: vi.fn(),
  deleteEquipmentPreset: vi.fn(),
  renameEquipmentPreset: vi.fn(),
}));

import * as db from "./db";

describe("equipmentPresets.listAll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all presets for a user, grouped by exercise", async () => {
    const mockPresets = [
      { id: 1, userId: 42, exerciseName: "Kneeling Cable Crunch", presetName: "T&V Pro Max", lastSettings: "Height 3", createdAt: new Date(), updatedAt: new Date() },
      { id: 2, userId: 42, exerciseName: "Kneeling Cable Crunch", presetName: "T&V Freedom Trainer", lastSettings: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 3, userId: 42, exerciseName: "Leg Press", presetName: "Plate Loaded", lastSettings: "Seat 2", createdAt: new Date(), updatedAt: new Date() },
    ];
    vi.mocked(db.getAllEquipmentPresets).mockResolvedValue(mockPresets as any);

    const result = await db.getAllEquipmentPresets(42);
    expect(result).toHaveLength(3);
    const exerciseNames = [...new Set(result.map((p: any) => p.exerciseName))];
    expect(exerciseNames).toContain("Kneeling Cable Crunch");
    expect(exerciseNames).toContain("Leg Press");
  });

  it("returns empty array when user has no presets", async () => {
    vi.mocked(db.getAllEquipmentPresets).mockResolvedValue([]);
    const result = await db.getAllEquipmentPresets(99);
    expect(result).toEqual([]);
  });

  it("rename mutation updates presetName", async () => {
    vi.mocked(db.renameEquipmentPreset).mockResolvedValue(undefined);
    await db.renameEquipmentPreset(42, 1, "New Name");
    expect(db.renameEquipmentPreset).toHaveBeenCalledWith(42, 1, "New Name");
  });

  it("delete mutation removes preset by id scoped to user", async () => {
    vi.mocked(db.deleteEquipmentPreset).mockResolvedValue(undefined);
    await db.deleteEquipmentPreset(42, 1);
    expect(db.deleteEquipmentPreset).toHaveBeenCalledWith(42, 1);
  });
});
