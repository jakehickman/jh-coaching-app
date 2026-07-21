import { eq, desc, asc, and, gte, lt, sql, inArray } from "drizzle-orm";
import {
  InsertUser,
  users,
  clientProfiles,
  dailyLogs,
  measurements,
  mealPlans,
  macroTargets,
  MacroMeal,
  shoppingItems,
  trainingPrograms,
  mesoCycles,
  mesoSessions,
  timelineMilestones,
  coachingNotes,
  weeklyCheckIns,
  exerciseLibrary,
  InsertExerciseLibraryEntry,
  nutritionFoods,
  NutritionFood,
  InsertNutritionFood,
  foodServings,
  FoodServing,
  workoutSessions,
  onboardingSubmissions,
  InsertOnboardingSubmission,
  checkInSubmissions,
  CheckInSubmission,
  InsertCheckInSubmission,
  checkInCycles,
  checkInHistory,
  CheckInCycle,
  CheckInHistoryRow,
  equipmentPresets,
  EquipmentPreset,
  WorkoutExercise,
  mealPlanHistory,
  MealPlanHistoryRow,
  progressPhotos,
  ProgressPhoto,
  InsertProgressPhoto,
  programChangeLogs,
  ProgramChangeEntry,
  cardioChangeLogs,
  CardioChangeEntry,
  TrainingDay,
  TrainingExercise,
  checkInQuestions,
  checkInAnswers,
  CheckInQuestion,
  CheckInAnswer,
  InsertCheckInQuestion,
  clientQuestionOverrides,
  ClientQuestionOverride,
  inviteTokens,
  InviteToken,
  habits,
  habitAssignments,
  habitCompletions,
  mealHabitCompletions,
  Habit,
  InsertHabit,
  HabitAssignment,
  HabitCompletion,
  MealHabitCompletion,
  mealLogs,
  deviceTokens,
  DeviceToken,
} from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { getDb } from "./connection";

export async function getMealPlan(userId: number, dayType: "training" | "rest") {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.userId, userId), eq(mealPlans.dayType, dayType)))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertMealPlan(data: {
  userId: number;
  coachId?: number;
  dayType: "training" | "rest";
  meals?: unknown;
  supplements?: { name: string; dose: string; timing: string }[] | null;
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  treatAllowanceKcal?: number | null;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await getMealPlan(data.userId, data.dayType);
  if (existing) {
    // Explicitly include notes (even null) so clearing it persists
    const updateData: any = { ...data, updatedAt: new Date() };
    if ('notes' in data) updateData.notes = data.notes ?? null;
    await db
      .update(mealPlans)
      .set(updateData)
      .where(eq(mealPlans.id, existing.id));
  } else {
    await db.insert(mealPlans).values(data as any);
  }
}

export async function getMealPlanHistory(userId: number): Promise<MealPlanHistoryRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(mealPlanHistory)
    .where(eq(mealPlanHistory.userId, userId))
    .orderBy(desc(mealPlanHistory.changedAt));
}

export async function updateMealPlanHistoryNote(id: number, note: string | null) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(mealPlanHistory)
    .set({ note })
    .where(eq(mealPlanHistory.id, id));
}

export async function deleteMealPlanHistoryEntry(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(mealPlanHistory).where(eq(mealPlanHistory.id, id));
}

export async function getNutritionMode(userId: number): Promise<"meal_plan" | "macros"> {
  const db = await getDb();
  if (!db) return "meal_plan";
  const result = await db
    .select({ nutritionMode: clientProfiles.nutritionMode })
    .from(clientProfiles)
    .where(eq(clientProfiles.userId, userId))
    .limit(1);
  return (result[0]?.nutritionMode as "meal_plan" | "macros") ?? "meal_plan";
}

export async function setNutritionMode(userId: number, mode: "meal_plan" | "macros") {
  const db = await getDb();
  if (!db) return;
  await db
    .update(clientProfiles)
    .set({ nutritionMode: mode } as any)
    .where(eq(clientProfiles.userId, userId));
}

export async function getMacroTarget(userId: number, dayType: "training" | "rest") {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(macroTargets)
    .where(and(eq(macroTargets.userId, userId), eq(macroTargets.dayType, dayType)))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertMacroTarget(data: {
  userId: number;
  coachId?: number;
  dayType: "training" | "rest";
  meals?: MacroMeal[];
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await getMacroTarget(data.userId, data.dayType);
  if (existing) {
    await db
      .update(macroTargets)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(macroTargets.id, existing.id));
  } else {
    await db.insert(macroTargets).values(data as any);
  }
}

export async function insertMealPlanHistorySnapshot(data: {
  userId: number;
  coachId?: number;
  trainingCalories?: number | null;
  trainingProtein?: number | null;
  trainingCarbs?: number | null;
  trainingFat?: number | null;
  restCalories?: number | null;
  restProtein?: number | null;
  restCarbs?: number | null;
  restFat?: number | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(mealPlanHistory).values(data as any);
}

export async function getShoppingItems(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(shoppingItems)
    .where(eq(shoppingItems.userId, userId))
    .orderBy(shoppingItems.category, shoppingItems.sortOrder);
}

export async function toggleShoppingItem(id: number, checked: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(shoppingItems).set({ checked }).where(eq(shoppingItems.id, id));
}

export async function addShoppingItem(data: {
  userId: number;
  category?: string;
  itemName: string;
  quantity?: string;
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(shoppingItems).values(data as any);
}

export async function deleteShoppingItem(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(shoppingItems).where(eq(shoppingItems.id, id));
}
