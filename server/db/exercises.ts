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

export async function listExercises() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(exerciseLibrary).orderBy(exerciseLibrary.name);
}

export async function upsertExercise(data: InsertExerciseLibraryEntry & { id?: number }) {
  const db = await getDb();
  if (!db) return;
  if (data.id) {
    const { id, ...rest } = data;
    // Get old name before updating so we can cascade rename
    const [existing] = await db.select({ name: exerciseLibrary.name }).from(exerciseLibrary).where(eq(exerciseLibrary.id, id));
    await db.update(exerciseLibrary).set({ ...rest, updatedAt: new Date() } as any).where(eq(exerciseLibrary.id, id));
    // Cascade rename: update training programs and workout sessions if name changed
    if (existing && data.name && existing.name !== data.name) {
      const oldName = existing.name;
      const newName = data.name;
      // Update training programs (use raw sql to ensure JSON is serialised correctly)
      const programs = await db.select({ id: trainingPrograms.id, days: trainingPrograms.days }).from(trainingPrograms);
      for (const prog of programs) {
        const days = prog.days as any[];
        if (!Array.isArray(days)) continue;
        let changed = false;
        const updatedDays = days.map((day: any) => {
          if (!Array.isArray(day.exercises)) return day;
          const updatedExercises = day.exercises.map((ex: any) => {
            if (ex.name === oldName) { changed = true; return { ...ex, name: newName }; }
            return ex;
          });
          return { ...day, exercises: updatedExercises };
        });
        if (changed) {
          await db.update(trainingPrograms).set({ days: sql`${JSON.stringify(updatedDays)}` } as any).where(eq(trainingPrograms.id, prog.id));
        }
      }
      // Update workout sessions (use raw sql to ensure JSON is serialised correctly)
      const sessions = await db.select({ id: workoutSessions.id, exercises: workoutSessions.exercises }).from(workoutSessions);
      for (const session of sessions) {
        const exercises = session.exercises as any[];
        if (!Array.isArray(exercises)) continue;
        let changed = false;
        const updatedExercises = exercises.map((ex: any) => {
          if (ex.name === oldName) { changed = true; return { ...ex, name: newName }; }
          return ex;
        });
        if (changed) {
          await db.update(workoutSessions).set({ exercises: sql`${JSON.stringify(updatedExercises)}` } as any).where(eq(workoutSessions.id, session.id));
        }
      }
    }
  } else {
    await db.insert(exerciseLibrary).values(data as any);
  }
}

export async function deleteExercise(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(exerciseLibrary).where(eq(exerciseLibrary.id, id));
}
