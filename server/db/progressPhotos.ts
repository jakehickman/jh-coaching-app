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

export async function insertProgressPhoto(data: InsertProgressPhoto): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(progressPhotos).values(data);
}

export async function getProgressPhotosByWeek(
  clientId: number,
  weekNumber: number
): Promise<ProgressPhoto[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(progressPhotos)
    .where(and(eq(progressPhotos.clientId, clientId), eq(progressPhotos.weekNumber, weekNumber)))
    .orderBy(asc(progressPhotos.uploadedAt));
}

export async function getProgressPhotosForCompare(
  clientId: number,
  weekA: number,
  weekB: number
): Promise<ProgressPhoto[]> {
  const db = await getDb();
  if (!db) return [];
  const { inArray } = await import("drizzle-orm");
  return db
    .select()
    .from(progressPhotos)
    .where(
      and(
        eq(progressPhotos.clientId, clientId),
        inArray(progressPhotos.weekNumber, [weekA, weekB])
      )
    )
    .orderBy(asc(progressPhotos.weekNumber), asc(progressPhotos.uploadedAt));
}

export async function deleteProgressPhoto(id: number, coachId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(progressPhotos)
    .where(and(eq(progressPhotos.id, id), eq(progressPhotos.coachId, coachId)))
    .limit(1);
  if (!rows[0]) return null;
  const s3Key = rows[0].s3Key;
  await db.delete(progressPhotos).where(eq(progressPhotos.id, id));
  return s3Key;
}

export async function getProgressPhotoWeeks(clientId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ weekNumber: progressPhotos.weekNumber })
    .from(progressPhotos)
    .where(eq(progressPhotos.clientId, clientId))
    .orderBy(asc(progressPhotos.weekNumber));
  return rows.map((r) => r.weekNumber);
}
