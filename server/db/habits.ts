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

export async function listHabitsByCoach(coachId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(habits)
    .where(and(eq(habits.coachId, coachId), eq(habits.deleted, false)))
    .orderBy(habits.sortOrder, habits.createdAt);
}

export async function reorderHabits(coachId: number, items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db || items.length === 0) return;
  await Promise.all(
    items.map(({ id, sortOrder }) =>
      db.update(habits).set({ sortOrder }).where(and(eq(habits.id, id), eq(habits.coachId, coachId)))
    )
  );
}

export async function createHabit(data: Omit<InsertHabit, "id" | "createdAt" | "updatedAt" | "deleted">) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(habits).values({ ...data, deleted: false });
  return result;
}

export async function updateHabit(id: number, coachId: number, data: Partial<Pick<Habit, "name" | "description" | "scope" | "frequency" | "targetDays" | "startDate">>) {
  const db = await getDb();
  if (!db) return;
  await db.update(habits).set(data).where(and(eq(habits.id, id), eq(habits.coachId, coachId)));
}

export async function deleteHabit(id: number, coachId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(habits).set({ deleted: true }).where(and(eq(habits.id, id), eq(habits.coachId, coachId)));
}

export async function getHabitAssignments(habitId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(habitAssignments).where(eq(habitAssignments.habitId, habitId));
}

export async function setHabitAssignments(habitId: number, clientIds: number[]) {
  const db = await getDb();
  if (!db) return;
  // Deactivate all existing assignments for this habit
  await db.update(habitAssignments).set({ active: false }).where(eq(habitAssignments.habitId, habitId));
  if (clientIds.length === 0) return;
  // Upsert: reactivate or insert for each clientId
  for (const clientId of clientIds) {
    const existing = await db
      .select()
      .from(habitAssignments)
      .where(and(eq(habitAssignments.habitId, habitId), eq(habitAssignments.clientId, clientId)));
    if (existing.length > 0) {
      await db.update(habitAssignments).set({ active: true }).where(and(eq(habitAssignments.habitId, habitId), eq(habitAssignments.clientId, clientId)));
    } else {
      await db.insert(habitAssignments).values({ habitId, clientId, active: true });
    }
  }
}

export async function addHabitAssignment(habitId: number, clientId: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(habitAssignments)
    .where(and(eq(habitAssignments.habitId, habitId), eq(habitAssignments.clientId, clientId)));
  if (existing.length > 0) {
    await db.update(habitAssignments).set({ active: true })
      .where(and(eq(habitAssignments.habitId, habitId), eq(habitAssignments.clientId, clientId)));
  } else {
    await db.insert(habitAssignments).values({ habitId, clientId, active: true });
  }
}

export async function removeHabitAssignment(habitId: number, clientId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(habitAssignments).set({ active: false })
    .where(and(eq(habitAssignments.habitId, habitId), eq(habitAssignments.clientId, clientId)));
}

export async function listAssignedHabitsForClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  // Return active assigned habits that are not deleted
  const rows = await db
    .select({ habit: habits, assignment: habitAssignments })
    .from(habitAssignments)
    .innerJoin(habits, eq(habitAssignments.habitId, habits.id))
    .where(and(eq(habitAssignments.clientId, clientId), eq(habitAssignments.active, true), eq(habits.deleted, false)))
    .orderBy(habits.sortOrder, habits.createdAt);
  return rows.map(r => ({ ...r.habit, assignedAt: r.assignment.assignedAt }));
}

export async function listAssignedPerMealHabitsForClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ habit: habits, assignment: habitAssignments })
    .from(habitAssignments)
    .innerJoin(habits, eq(habitAssignments.habitId, habits.id))
    .where(and(
      eq(habitAssignments.clientId, clientId),
      eq(habitAssignments.active, true),
      eq(habits.deleted, false),
      eq(habits.scope, 'per_meal')
    ))
    .orderBy(habits.sortOrder, habits.createdAt);
  return rows.map(r => ({ ...r.habit, assignedAt: r.assignment.assignedAt }));
}

export async function toggleHabitCompletion(habitId: number, clientId: number, completedDate: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const existing = await db
    .select()
    .from(habitCompletions)
    .where(and(eq(habitCompletions.habitId, habitId), eq(habitCompletions.clientId, clientId), eq(habitCompletions.completedDate, completedDate as any)));
  if (existing.length > 0) {
    await db.delete(habitCompletions).where(and(eq(habitCompletions.habitId, habitId), eq(habitCompletions.clientId, clientId), eq(habitCompletions.completedDate, completedDate as any)));
    return false; // now incomplete
  } else {
    await db.insert(habitCompletions).values({ habitId, clientId, completedDate: completedDate as any });
    return true; // now complete
  }
}

export async function getHabitCompletionsForClient(clientId: number, fromDate?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(habitCompletions.clientId, clientId)];
  if (fromDate) conditions.push(gte(habitCompletions.completedDate, fromDate as any));
  return db.select().from(habitCompletions).where(and(...conditions));
}

export async function getMealHabitCompletions(clientId: number, mealLogIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (mealLogIds.length === 0) return [];
  return db
    .select()
    .from(mealHabitCompletions)
    .where(and(
      eq(mealHabitCompletions.clientId, clientId),
      sql`${mealHabitCompletions.mealLogId} IN (${sql.join(mealLogIds.map(id => sql`${id}`), sql`, `)})`
    ));
}

export async function toggleMealHabitCompletion(habitId: number, clientId: number, mealLogId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const existing = await db
    .select()
    .from(mealHabitCompletions)
    .where(and(
      eq(mealHabitCompletions.habitId, habitId),
      eq(mealHabitCompletions.clientId, clientId),
      eq(mealHabitCompletions.mealLogId, mealLogId)
    ));
  if (existing.length > 0) {
    await db.delete(mealHabitCompletions).where(and(
      eq(mealHabitCompletions.habitId, habitId),
      eq(mealHabitCompletions.clientId, clientId),
      eq(mealHabitCompletions.mealLogId, mealLogId)
    ));
    return false;
  } else {
    await db.insert(mealHabitCompletions).values({ habitId, clientId, mealLogId });
    return true;
  }
}

export async function getMealHabitAdherence(clientId: number, fromDate?: string) {
  // Returns: total meals (type='meal') in range, and per-habit completion counts
  const db = await getDb();
  if (!db) return { totalMeals: 0, habits: [] };
  // Get all meal (not treat) entries for client in range
  const mealConditions: any[] = [
    eq(mealLogs.userId, clientId),
    eq(mealLogs.mealType, 'meal'),
  ];
  if (fromDate) {
    const fromTs = new Date(fromDate + 'T00:00:00Z');
    mealConditions.push(gte(mealLogs.loggedAt, fromTs));
  }
  const meals = await db.select({ id: mealLogs.id }).from(mealLogs).where(and(...mealConditions));
  const mealIds = meals.map(m => m.id);
  const totalMeals = mealIds.length;
  if (totalMeals === 0) return { totalMeals: 0, habits: [] };
  // Get assigned per_meal habits for this client
  const assignedHabits = await db
    .select({ habit: habits, assignment: habitAssignments })
    .from(habitAssignments)
    .innerJoin(habits, eq(habitAssignments.habitId, habits.id))
    .where(and(
      eq(habitAssignments.clientId, clientId),
      eq(habitAssignments.active, true),
      eq(habits.deleted, false),
      eq(habits.scope, 'per_meal')
    ));
  if (assignedHabits.length === 0) return { totalMeals, habits: [] };
  // Count completions per habit within those meal IDs
  const completionCounts = await db
    .select({ habitId: mealHabitCompletions.habitId, count: sql<number>`count(*)` })
    .from(mealHabitCompletions)
    .where(and(
      eq(mealHabitCompletions.clientId, clientId),
      sql`${mealHabitCompletions.mealLogId} IN (${sql.join(mealIds.map(id => sql`${id}`), sql`, `)})`
    ))
    .groupBy(mealHabitCompletions.habitId);
  const countMap = new Map(completionCounts.map(c => [c.habitId, Number(c.count)]));
  return {
    totalMeals,
    habits: assignedHabits.map(({ habit, assignment }) => ({
      ...habit,
      assignedAt: assignment.assignedAt,
      completedCount: countMap.get(habit.id) ?? 0,
    })),
  };
}
