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

export async function createInviteToken(coachId: number, label: string | null, token: string, expiresAt: Date | null, profileEmail?: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.insert(inviteTokens).values({ token, coachId, label: label ?? undefined, expiresAt: expiresAt ?? undefined, profileEmail: profileEmail ?? undefined });
}

export async function getInviteToken(token: string): Promise<InviteToken | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(inviteTokens).where(eq(inviteTokens.token, token)).limit(1);
  return rows[0] ?? null;
}

export async function redeemInviteToken(token: string, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(inviteTokens)
    .set({ usedByUserId: userId, usedAt: new Date() })
    .where(eq(inviteTokens.token, token));
}

export async function listInviteTokens(coachId: number): Promise<InviteToken[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inviteTokens).where(eq(inviteTokens.coachId, coachId));
}

export async function deleteInviteToken(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(inviteTokens).where(eq(inviteTokens.id, id));
}
