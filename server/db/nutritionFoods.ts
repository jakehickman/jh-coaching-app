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

export async function listNutritionFoods() {
  const db = await getDb();
  if (!db) return [];
  const foods = await db.select().from(nutritionFoods).orderBy(nutritionFoods.name);
  if (foods.length === 0) return [];
  // Fetch all servings in one query (more efficient than a large IN clause for 7k+ foods)
  const servings = await db.select().from(foodServings).orderBy(foodServings.sortOrder);
  // Group servings by foodId
  const servingMap = new Map<number, FoodServing[]>();
  for (const s of servings) {
    if (!servingMap.has(s.foodId)) servingMap.set(s.foodId, []);
    servingMap.get(s.foodId)!.push(s);
  }
  return foods.map(f => ({ ...f, servings: servingMap.get(f.id) ?? [] }));
}

export async function searchNutritionFoods(query: string, limit = 25) {
  const db = await getDb();
  if (!db) return [];
  const q = query.trim();
  if (!q) {
    // Return first 25 alphabetically when no query
    const foods = await db
      .select({ id: nutritionFoods.id, name: nutritionFoods.name, calories: nutritionFoods.calories, protein: nutritionFoods.protein, carbs: nutritionFoods.carbs, fat: nutritionFoods.fat })
      .from(nutritionFoods)
      .orderBy(nutritionFoods.name)
      .limit(limit);
    return foods;
  }
  // Use SQL CASE for relevance: starts-with = 0, word-boundary = 1, contains = 2
  const like = `%${q}%`;
  const startLike = `${q}%`;
  const wordLike = `%, ${q}%`;
  const foods = await db
    .select({
      id: nutritionFoods.id,
      name: nutritionFoods.name,
      calories: nutritionFoods.calories,
      protein: nutritionFoods.protein,
      carbs: nutritionFoods.carbs,
      fat: nutritionFoods.fat,
    })
    .from(nutritionFoods)
    .where(sql`LOWER(${nutritionFoods.name}) LIKE LOWER(${like})`)
    .orderBy(
      sql`CASE
        WHEN LOWER(${nutritionFoods.name}) LIKE LOWER(${startLike}) THEN 0
        WHEN LOWER(${nutritionFoods.name}) LIKE LOWER(${wordLike}) THEN 1
        ELSE 2
      END`,
      nutritionFoods.name
    )
    .limit(limit);
  return foods;
}

export async function getServingsForFood(foodId: number): Promise<FoodServing[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(foodServings)
    .where(eq(foodServings.foodId, foodId))
    .orderBy(foodServings.sortOrder);
}

export async function getServingsForFoods(foodIds: number[]): Promise<FoodServing[]> {
  const db = await getDb();
  if (!db || foodIds.length === 0) return [];
  return db
    .select()
    .from(foodServings)
    .where(sql`${foodServings.foodId} IN (${sql.join(foodIds.map(id => sql`${id}`), sql`, `)})`)
    .orderBy(foodServings.sortOrder);
}

export async function upsertFoodServing(data: { id?: number; foodId: number; label: string; grams: number; sortOrder?: number }) {
  const db = await getDb();
  if (!db) return;
  if (data.id) {
    await db.update(foodServings).set({ label: data.label, grams: data.grams, sortOrder: data.sortOrder ?? 0 }).where(eq(foodServings.id, data.id));
  } else {
    await db.insert(foodServings).values({ foodId: data.foodId, label: data.label, grams: data.grams, sortOrder: data.sortOrder ?? 0 });
  }
}

export async function deleteFoodServing(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(foodServings).where(eq(foodServings.id, id));
}

export async function upsertNutritionFood(data: InsertNutritionFood & { id?: number }) {
  const db = await getDb();
  if (!db) return;
  if (data.id) {
    const { id, ...rest } = data;
    // Get old name before updating so we can cascade rename to meal plans
    const [existing] = await db.select({ name: nutritionFoods.name }).from(nutritionFoods).where(eq(nutritionFoods.id, id));
    await db.update(nutritionFoods).set({ ...rest, updatedAt: new Date() } as any).where(eq(nutritionFoods.id, id));
    // Cascade rename: update all meal plans that reference the old food name
    if (existing && data.name && existing.name !== data.name) {
      const oldName = existing.name;
      const newName = data.name;
      const plans = await db.select({ id: mealPlans.id, meals: mealPlans.meals }).from(mealPlans);
      for (const plan of plans) {
        const meals = plan.meals as any[];
        if (!Array.isArray(meals)) continue;
        let changed = false;
        const updatedMeals = meals.map((meal: any) => {
          if (!Array.isArray(meal.items)) return meal;
          const updatedItems = meal.items.map((item: any) => {
            if (item.food === oldName) { changed = true; return { ...item, food: newName }; }
            return item;
          });
          return { ...meal, items: updatedItems };
        });
        if (changed) {
          await db.update(mealPlans).set({ meals: sql`${JSON.stringify(updatedMeals)}` } as any).where(eq(mealPlans.id, plan.id));
        }
      }
    }
  } else {
    await db.insert(nutritionFoods).values(data as any);
  }
}

export async function deleteNutritionFood(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(nutritionFoods).where(eq(nutritionFoods.id, id));
}
