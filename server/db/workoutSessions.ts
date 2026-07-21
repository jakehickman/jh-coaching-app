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
import { upsertDailyLog } from "./dailyLogs";
import { upsertEquipmentPreset } from "./equipmentPresets";

export async function listWorkoutSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.userId, userId))
    .orderBy(desc(workoutSessions.sessionDate));
}

export async function saveWorkoutSession(data: {
  userId: number;
  sessionDate: string;
  dayLabel: string;
  exercises: WorkoutExercise[];
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  // Upsert: if a session exists for same userId + sessionDate + dayLabel, update it
  const existing = await db
    .select()
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, data.userId),
        eq(workoutSessions.sessionDate, data.sessionDate as any),
        eq(workoutSessions.dayLabel, data.dayLabel)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(workoutSessions)
      .set({ exercises: data.exercises, notes: data.notes ?? null, updatedAt: new Date() })
      .where(eq(workoutSessions.id, existing[0].id));
  } else {
    await db.insert(workoutSessions).values(data as any);
  }
  // Auto-save any machine presets from the exercises and backfill presetId into the JSON
  let needsPresetIdUpdate = false;
  const enrichedExercises = [...data.exercises];
  for (const ex of enrichedExercises) {
    if (ex.machinePreset) {
      const presetId = await upsertEquipmentPreset(data.userId, ex.name, ex.machinePreset, ex.machineSettings ?? null);
      if (presetId && !ex.presetId) {
        ex.presetId = presetId;
        needsPresetIdUpdate = true;
      }
    }
  }
  // If we just resolved new presetIds, update the stored exercises JSON
  if (needsPresetIdUpdate) {
    const sessionId = existing.length > 0 ? existing[0].id : undefined;
    if (sessionId) {
      await db.update(workoutSessions).set({ exercises: enrichedExercises }).where(eq(workoutSessions.id, sessionId));
    } else {
      // For newly inserted sessions, fetch the just-created row
      const newSession = await db.select().from(workoutSessions)
        .where(and(eq(workoutSessions.userId, data.userId), eq(workoutSessions.sessionDate, data.sessionDate as any), eq(workoutSessions.dayLabel, data.dayLabel)))
        .limit(1);
      if (newSession.length > 0) {
        await db.update(workoutSessions).set({ exercises: enrichedExercises }).where(eq(workoutSessions.id, newSession[0].id));
      }
    }
  }
  // Always sync trainingCompleted = true to the daily log for this date
  await upsertDailyLog({
    userId: data.userId,
    logDate: data.sessionDate,
    trainingCompleted: true,
    trainingType: data.dayLabel,
  });
  return existing.length > 0 ? existing[0].id : undefined;
}

export async function patchWorkoutSessionExercisePreset(
  sessionId: number,
  userId: number,
  exerciseName: string,
  machinePreset: string | null,
  machineSettings: string | null
) {
  const db = await getDb();
  if (!db) return;
  const [session] = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)))
    .limit(1);
  if (!session) return;
  const exercises: WorkoutExercise[] = (session.exercises as WorkoutExercise[]) ?? [];
  const updated = exercises.map(ex =>
    ex.name === exerciseName
      ? { ...ex, machinePreset: machinePreset ?? ex.machinePreset, machineSettings: machineSettings ?? ex.machineSettings }
      : ex
  );
  await db
    .update(workoutSessions)
    .set({ exercises: updated, updatedAt: new Date() })
    .where(eq(workoutSessions.id, sessionId));
}

export async function deleteWorkoutSession(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;

  // Fetch the session date before deleting so we can update the daily log afterwards
  const [session] = await db
    .select({ sessionDate: workoutSessions.sessionDate })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, userId)))
    .limit(1);

  await db
    .delete(workoutSessions)
    .where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, userId)));

  // After deletion, if no complete sessions remain for that date, revert trainingCompleted
  if (session?.sessionDate) {
    const rawDate = session.sessionDate as unknown;
    const dateStr = typeof rawDate === 'string'
      ? rawDate.slice(0, 10)
      : rawDate instanceof Date
        ? rawDate.toISOString().slice(0, 10)
        : String(rawDate).slice(0, 10);

    const remaining = await db
      .select({ exercises: workoutSessions.exercises })
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, userId),
          sql`DATE(${workoutSessions.sessionDate}) = ${dateStr}`
        )
      );

    const anyComplete = remaining.some(s => {
      const exs: any[] = Array.isArray(s.exercises) ? s.exercises : [];
      return exs.length > 0 && exs.every(ex => {
        const sets: any[] = Array.isArray(ex.sets) ? ex.sets : [];
        return sets.length > 0 && sets.every((set: any) => set.completed);
      });
    });

    if (!anyComplete) {
      await upsertDailyLog({ userId, logDate: dateStr, trainingCompleted: false, trainingType: undefined, force: true });
    }
  }
}

export async function updateWorkoutSessionDate(id: number, userId: number, newDate: string) {
  const db = await getDb();
  if (!db) return;

  // Fetch the session before updating so we know the old date and dayLabel
  const [session] = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, userId)))
    .limit(1);
  if (!session) return;

  const oldDate = session.sessionDate as unknown as string;
  const dayLabel = session.dayLabel as string;

  // Update the workout session date
  await db
    .update(workoutSessions)
    .set({ sessionDate: newDate as any })
    .where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, userId)));

  // Clear training from the old date's daily log (only if no other session exists on that date)
  const otherSessionsOnOldDate = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.sessionDate, oldDate as any)))
    .limit(1);
  if (otherSessionsOnOldDate.length === 0) {
    // No other sessions on the old date — clear trainingCompleted and trainingType
    await upsertDailyLog({
      userId,
      logDate: oldDate,
      trainingCompleted: false,
      trainingType: null as any,
      force: true,
    });
  }

  // Upsert the new date's daily log with trainingCompleted = true and correct session type
  await upsertDailyLog({
    userId,
    logDate: newDate,
    trainingCompleted: true,
    trainingType: dayLabel,
  });
}
