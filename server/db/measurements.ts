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

export async function getMeasurements(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(measurements)
    .where(eq(measurements.userId, userId))
    .orderBy(desc(measurements.measureDate));
}

export async function deleteMeasurement(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(measurements).where(and(eq(measurements.id, id), eq(measurements.userId, userId)));
}

export async function addMeasurement(data: {
  userId: number;
  measureDate: string;
  waist?: number;
  hips?: number;
  umbilical1?: number; umbilical2?: number; umbilical3?: number; umbilical4?: number; umbilical5?: number;
  suprailiac1?: number; suprailiac2?: number; suprailiac3?: number; suprailiac4?: number; suprailiac5?: number;
  calf1?: number; calf2?: number; calf3?: number; calf4?: number; calf5?: number;
  thigh1?: number; thigh2?: number; thigh3?: number; thigh4?: number; thigh5?: number;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(measurements).values(data as any);
}

export async function updateMeasurement(id: number, userId: number, data: {
  measureDate?: string;
  waist?: number | null;
  hips?: number | null;
  umbilical1?: number | null; umbilical2?: number | null; umbilical3?: number | null; umbilical4?: number | null; umbilical5?: number | null;
  suprailiac1?: number | null; suprailiac2?: number | null; suprailiac3?: number | null; suprailiac4?: number | null; suprailiac5?: number | null;
  calf1?: number | null; calf2?: number | null; calf3?: number | null; calf4?: number | null; calf5?: number | null;
  thigh1?: number | null; thigh2?: number | null; thigh3?: number | null; thigh4?: number | null; thigh5?: number | null;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(measurements).set(data as any).where(and(eq(measurements.id, id), eq(measurements.userId, userId)));
}
