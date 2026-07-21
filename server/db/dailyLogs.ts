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

export async function getDailyLogs(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(dailyLogs)
    .where(eq(dailyLogs.userId, userId))
    .orderBy(desc(dailyLogs.logDate))
    .limit(limit);
}

export async function getDailyLogByDate(userId: number, logDate: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.logDate, logDate as any)))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertDailyLog(data: {
  userId: number;
  logDate: string;
  weight?: number;
  sleepHours?: number;
  caffeineServings?: number;
  trainingCompleted?: boolean;
  trainingType?: string;
  stepsCount?: number;
  lissMinutes?: number;
  sleepQuality?: number;
  hungerLevel?: number;
  stressLevel?: number;
  offPlanMeals?: number;
  notes?: string;
  force?: boolean; // if true, bypass the trainingCompleted guard (used by deleteWorkoutSession)
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await getDailyLogByDate(data.userId, data.logDate);
  if (existing) {
    // Never overwrite a workout-synced trainingCompleted=true with false from the daily log form.
    // Only allow trainingCompleted to change if the caller is explicitly setting it to true,
    // if the existing value is already false, or if force=true (e.g. deleteWorkoutSession).
    const updatePayload = { ...data };
    if (!data.force && existing.trainingCompleted && updatePayload.trainingCompleted === false) {
      delete updatePayload.trainingCompleted;
      delete updatePayload.trainingType;
    }
    delete updatePayload.force;
    await db
      .update(dailyLogs)
      .set({ ...updatePayload, updatedAt: new Date() } as any)
      .where(eq(dailyLogs.id, existing.id));
  } else {
    await db.insert(dailyLogs).values(data as any);
  }
}

export async function deleteDailyLog(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(dailyLogs).where(and(eq(dailyLogs.id, id), eq(dailyLogs.userId, userId)));
}
