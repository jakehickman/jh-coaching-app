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

export async function getEquipmentPresets(userId: number, exerciseName: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(equipmentPresets)
    .where(and(eq(equipmentPresets.userId, userId), eq(equipmentPresets.exerciseName, exerciseName)))
    .orderBy(equipmentPresets.presetName);
}

export async function getAllEquipmentPresets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(equipmentPresets)
    .where(eq(equipmentPresets.userId, userId))
    .orderBy(equipmentPresets.exerciseName, equipmentPresets.presetName);
}

export async function upsertEquipmentPreset(userId: number, exerciseName: string, presetName: string, lastSettings?: string | null): Promise<number | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const existing = await db
    .select()
    .from(equipmentPresets)
    .where(and(eq(equipmentPresets.userId, userId), eq(equipmentPresets.exerciseName, exerciseName), eq(equipmentPresets.presetName, presetName)))
    .limit(1);
  if (existing.length > 0) {
    if (lastSettings !== undefined) {
      await db.update(equipmentPresets)
        .set({ lastSettings: lastSettings ?? null })
        .where(eq(equipmentPresets.id, existing[0].id));
    }
    return existing[0].id;
  } else {
    const [result] = await db.insert(equipmentPresets).values({ userId, exerciseName, presetName, lastSettings: lastSettings ?? null });
    return (result as any).insertId as number;
  }
}

export async function deleteEquipmentPreset(userId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(equipmentPresets).where(and(eq(equipmentPresets.id, id), eq(equipmentPresets.userId, userId)));
}

export async function renameEquipmentPreset(userId: number, id: number, newName: string) {
  const db = await getDb();
  if (!db) return;

  // Fetch the current preset name before renaming
  const existing = await db.select().from(equipmentPresets)
    .where(and(eq(equipmentPresets.id, id), eq(equipmentPresets.userId, userId)))
    .limit(1);
  if (!existing.length) return;
  const oldName = existing[0].presetName;
  const exerciseName = existing[0].exerciseName;

  // Rename the preset record
  await db.update(equipmentPresets)
    .set({ presetName: newName })
    .where(and(eq(equipmentPresets.id, id), eq(equipmentPresets.userId, userId)));

  // Backfill historical workout_sessions for this user
  const wsSessions = await db.select({ id: workoutSessions.id, exercises: workoutSessions.exercises })
    .from(workoutSessions)
    .where(eq(workoutSessions.userId, userId));
  for (const session of wsSessions) {
    const exs: any[] = Array.isArray(session.exercises) ? session.exercises : [];
    let changed = false;
    for (const ex of exs) {
      if (ex.name === exerciseName && ex.machinePreset === oldName) {
        ex.machinePreset = newName;
        changed = true;
      }
    }
    if (changed) {
      await db.update(workoutSessions)
        .set({ exercises: exs })
        .where(eq(workoutSessions.id, session.id));
    }
  }

  // Backfill historical meso_sessions for this user
  const msSessions = await db.select({ id: mesoSessions.id, exercises: mesoSessions.exercises })
    .from(mesoSessions)
    .where(eq(mesoSessions.userId, userId));
  for (const session of msSessions) {
    const exs: any[] = Array.isArray(session.exercises) ? session.exercises : [];
    let changed = false;
    for (const ex of exs) {
      if (ex.name === exerciseName && ex.machinePreset === oldName) {
        ex.machinePreset = newName;
        changed = true;
      }
    }
    if (changed) {
      await db.update(mesoSessions)
        .set({ exercises: exs })
        .where(eq(mesoSessions.id, session.id));
    }
  }
}
