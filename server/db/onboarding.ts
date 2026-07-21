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

export async function createOnboardingSubmission(
  data: Omit<InsertOnboardingSubmission, "id" | "submittedAt" | "reviewed">
) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(onboardingSubmissions).values({
    ...data,
    reviewed: false,
  });
  return result;
}

export async function listOnboardingSubmissions() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(onboardingSubmissions)
    .orderBy(onboardingSubmissions.submittedAt);
}

export async function markOnboardingReviewed(id: number, reviewed: boolean) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(onboardingSubmissions)
    .set({ reviewed })
    .where(eq(onboardingSubmissions.id, id));
}
