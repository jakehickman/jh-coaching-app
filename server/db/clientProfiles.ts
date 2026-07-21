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

export async function getClientProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(clientProfiles)
    .where(eq(clientProfiles.userId, userId))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertClientProfile(data: {
  userId: number;
  coachId?: number;
  displayName?: string;
  startDate?: string;
  notes?: string | null;
  photoType?: "standard" | "athlete";
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await getClientProfile(data.userId);
  if (existing) {
    await db
      .update(clientProfiles)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(clientProfiles.userId, data.userId));
  } else {
    // Auto-set startDate to today (UTC date) if not explicitly provided
    const today = new Date();
    const todayIso = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;
    await db.insert(clientProfiles).values({ startDate: todayIso, ...data } as any);
  }
}

export async function updateClientProfileExtended(userId: number, data: {
  stepGoal?: number | null;
  lissSessionsPerWeek?: number | null;
  lissMinutesPerSession?: number | null;
}, coachId?: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(clientProfiles).where(eq(clientProfiles.userId, userId)).limit(1);
  if (existing.length > 0) {
    const prev = existing[0] as any;
    // Build a diff for cardio-related fields
    const cardioFields: Array<"stepGoal" | "lissSessionsPerWeek" | "lissMinutesPerSession"> =
      ["stepGoal", "lissSessionsPerWeek", "lissMinutesPerSession"];
    const changes: CardioChangeEntry[] = [];
    for (const field of cardioFields) {
      if (data[field] !== undefined && data[field] !== prev[field]) {
        changes.push({
          field,
          oldValue: prev[field] != null ? String(prev[field]) : null,
          newValue: data[field] != null ? String(data[field]) : null,
        });
      }
    }
    if (changes.length > 0) {
      // Merge into existing same-day row if one exists
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
      const [existingCardioLog] = await db
        .select()
        .from(cardioChangeLogs)
        .where(
          and(
            eq(cardioChangeLogs.userId, userId),
            gte(cardioChangeLogs.changedAt, todayStart),
            lt(cardioChangeLogs.changedAt, tomorrowStart)
          )
        )
        .limit(1);
      if (existingCardioLog) {
        const merged: CardioChangeEntry[] = [
          ...(Array.isArray(existingCardioLog.changes) ? existingCardioLog.changes : []),
          ...changes,
        ];
        await db.update(cardioChangeLogs).set({ changes: merged as any }).where(eq(cardioChangeLogs.id, existingCardioLog.id));
      } else {
        await db.insert(cardioChangeLogs).values({ userId, coachId: coachId ?? null, changes });
      }
    }
    // Also backfill coachId if it's missing
    const updateData: any = { ...data };
    if (coachId !== undefined && !prev.coachId) updateData.coachId = coachId;
    await db.update(clientProfiles).set(updateData).where(eq(clientProfiles.userId, userId));
  } else {
    await db.insert(clientProfiles).values({ userId, coachId, ...data } as any);
  }
}
