import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  clientProfiles,
  dailyLogs,
  measurements,
  mealPlans,
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
  workoutSessions,
  onboardingSubmissions,
  InsertOnboardingSubmission,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    // Auto-approve admins/owner
    if (user.openId === ENV.ownerOpenId || user.role === "admin") {
      values.approved = true;
      updateSet.approved = true;
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllClients(coachId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clientProfiles)
    .where(eq(clientProfiles.coachId, coachId));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function setUserApproved(userId: number, approved: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ approved }).where(eq(users.id, userId));
}

export async function getPendingApprovalCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.approved, false), eq(users.role, 'user')));
  return Number(result[0]?.count ?? 0);
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  // Delete related data first to avoid FK constraint errors
  await db.delete(clientProfiles).where(eq(clientProfiles.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

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
  goalWeight?: number;
  startWeight?: number;
  notes?: string | null;
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
    await db.insert(clientProfiles).values(data as any);
  }
}

// Daily Logs
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
  sleepQuality?: number;
  hungerLevel?: number;
  offPlanMeal?: boolean;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await getDailyLogByDate(data.userId, data.logDate);
  if (existing) {
    await db
      .update(dailyLogs)
      .set({ ...data, updatedAt: new Date() } as any)
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

// Measurements
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

// Meal Plans
export async function getMealPlan(userId: number, dayType: "training" | "rest") {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.userId, userId), eq(mealPlans.dayType, dayType)))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertMealPlan(data: {
  userId: number;
  coachId?: number;
  dayType: "training" | "rest";
  meals?: unknown;
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await getMealPlan(data.userId, data.dayType);
  if (existing) {
    // Explicitly include notes (even null) so clearing it persists
    const updateData: any = { ...data, updatedAt: new Date() };
    if ('notes' in data) updateData.notes = data.notes ?? null;
    await db
      .update(mealPlans)
      .set(updateData)
      .where(eq(mealPlans.id, existing.id));
  } else {
    await db.insert(mealPlans).values(data as any);
  }
}

// Shopping List
export async function getShoppingItems(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(shoppingItems)
    .where(eq(shoppingItems.userId, userId))
    .orderBy(shoppingItems.category, shoppingItems.sortOrder);
}

export async function toggleShoppingItem(id: number, checked: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(shoppingItems).set({ checked }).where(eq(shoppingItems.id, id));
}

export async function addShoppingItem(data: {
  userId: number;
  category?: string;
  itemName: string;
  quantity?: string;
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(shoppingItems).values(data as any);
}

export async function deleteShoppingItem(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(shoppingItems).where(eq(shoppingItems.id, id));
}

// Training Programs
export async function getTrainingProgram(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(trainingPrograms)
    .where(eq(trainingPrograms.userId, userId))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertTrainingProgram(data: {
  userId: number;
  coachId?: number;
  programName?: string | null;
  days?: unknown;
  schedule?: unknown;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await getTrainingProgram(data.userId);
  if (existing) {
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.notes === null || data.notes === "") updateData.notes = null;
    if (data.programName === null || data.programName === "") updateData.programName = null;
    await db
      .update(trainingPrograms)
      .set(updateData)
      .where(eq(trainingPrograms.id, existing.id));
  } else {
    await db.insert(trainingPrograms).values(data as any);
  }
}

export async function listAllTrainingPrograms() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trainingPrograms);
}
// MESO Cycles
export async function getMesoCycles(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(mesoCycles)
    .where(eq(mesoCycles.userId, userId))
    .orderBy(desc(mesoCycles.createdAt));
}

export async function getMesoSessions(mesoId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(mesoSessions)
    .where(eq(mesoSessions.mesoId, mesoId))
    .orderBy(mesoSessions.weekNumber, mesoSessions.dayLabel);
}

export async function upsertMesoSession(data: {
  id?: number;
  mesoId: number;
  userId: number;
  sessionDate?: string;
  weekNumber?: number;
  dayLabel?: string;
  exercises?: unknown;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) return;
  if (data.id) {
    const { id, ...rest } = data;
    await db.update(mesoSessions).set(rest as any).where(eq(mesoSessions.id, id));
  } else {
    await db.insert(mesoSessions).values(data as any);

  }
}

// Timeline
export async function getTimelineMilestones(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(timelineMilestones)
    .where(eq(timelineMilestones.userId, userId))
    .orderBy(timelineMilestones.milestoneDate);
}

export async function toggleMilestone(id: number, completed: boolean) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(timelineMilestones)
    .set({ completed })
    .where(eq(timelineMilestones.id, id));
}

// Coaching Notes
export async function getCoachingNotes(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(coachingNotes)
    .where(eq(coachingNotes.clientId, clientId))
    .orderBy(desc(coachingNotes.noteDate));
}

export async function addCoachingNote(data: {
  coachId: number;
  clientId: number;
  noteDate: string;
  content: string;
  category?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(coachingNotes).values(data as any);
}

export async function deleteCoachingNote(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(coachingNotes).where(eq(coachingNotes.id, id));
}

export async function updateCoachingNote(data: {
  id: number;
  noteDate?: string;
  content?: string;
  category?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const { id, ...fields } = data;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (fields.noteDate !== undefined) updateData.noteDate = fields.noteDate;
  if (fields.content !== undefined) updateData.content = fields.content;
  if (fields.category !== undefined) updateData.category = fields.category;
  await db.update(coachingNotes).set(updateData as any).where(eq(coachingNotes.id, id));
}

// Weekly Check-ins
export async function getWeeklyCheckIns(userId: number, limit = 12) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(weeklyCheckIns)
    .where(eq(weeklyCheckIns.userId, userId))
    .orderBy(desc(weeklyCheckIns.weekStartDate))
    .limit(limit);
}

export async function upsertWeeklyCheckIn(data: {
  userId: number;
  weekStartDate: string;
  avgWeight?: number;
  weightChange?: number;
  trainingAdherence?: number;
  nutritionAdherence?: number;
  overallFeeling?: number;
  wins?: string;
  challenges?: string;
  nextWeekGoals?: string;
  coachFeedback?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select()
    .from(weeklyCheckIns)
    .where(
      and(
        eq(weeklyCheckIns.userId, data.userId),
        eq(weeklyCheckIns.weekStartDate, data.weekStartDate as any)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(weeklyCheckIns)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(weeklyCheckIns.id, existing[0].id));
  } else {
    await db.insert(weeklyCheckIns).values(data as any);
  }
}

// ─── Exercise Library ────────────────────────────────────────────────────────
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

// ─── Nutrition Foods ─────────────────────────────────────────────────────────
export async function listNutritionFoods() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(nutritionFoods).orderBy(nutritionFoods.name);
}

export async function upsertNutritionFood(data: InsertNutritionFood & { id?: number }) {
  const db = await getDb();
  if (!db) return;
  if (data.id) {
    const { id, ...rest } = data;
    // Get old name before updating so we can cascade rename to meal plans
    const [existing] = await db.select({ name: nutritionFoods.name }).from(nutritionFoods).where(eq(nutritionFoods.id, id));
    await db.update(nutritionFoods).set({ ...rest, updatedAt: new Date() } as any).where(eq(nutritionFoods.id, id));
    // Cascade rename: update all meal plans that reference the old food name
    if (existing && data.name && existing.name !== data.name) {
      const oldName = existing.name;
      const newName = data.name;
      const plans = await db.select({ id: mealPlans.id, meals: mealPlans.meals }).from(mealPlans);
      for (const plan of plans) {
        const meals = plan.meals as any[];
        if (!Array.isArray(meals)) continue;
        let changed = false;
        const updatedMeals = meals.map((meal: any) => {
          if (!Array.isArray(meal.items)) return meal;
          const updatedItems = meal.items.map((item: any) => {
            if (item.food === oldName) { changed = true; return { ...item, food: newName }; }
            return item;
          });
          return { ...meal, items: updatedItems };
        });
        if (changed) {
          await db.update(mealPlans).set({ meals: sql`${JSON.stringify(updatedMeals)}` } as any).where(eq(mealPlans.id, plan.id));
        }
      }
    }
  } else {
    await db.insert(nutritionFoods).values(data as any);
  }
}

export async function deleteNutritionFood(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(nutritionFoods).where(eq(nutritionFoods.id, id));
}

// ─── Workout Sessions ─────────────────────────────────────────────────────────
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
  exercises: unknown;
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
    return existing[0].id;
  } else {
    const result = await db.insert(workoutSessions).values(data as any);
    return (result as any).insertId;
  }
}

export async function deleteWorkoutSession(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(workoutSessions)
    .where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, userId)));
}

// ── Onboarding submissions ────────────────────────────────────────────────────

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

// ─── Habits ──────────────────────────────────────────────────────────────────
import {
  habits,
  habitAssignments,
  habitCompletions,
  Habit,
  InsertHabit,
} from "../drizzle/schema";

export async function listHabitsByCoach(coachId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(habits)
    .where(and(eq(habits.coachId, coachId), eq(habits.deleted, false)))
    .orderBy(habits.createdAt);
}

export async function createHabit(data: Omit<InsertHabit, "id" | "createdAt" | "updatedAt" | "deleted">) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(habits).values({ ...data, deleted: false });
  return result;
}

export async function updateHabit(id: number, coachId: number, data: Partial<Pick<Habit, "name" | "description" | "frequency" | "targetDays" | "startDate">>) {
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

export async function listAssignedHabitsForClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  // Return active assigned habits that are not deleted
  const rows = await db
    .select({ habit: habits, assignment: habitAssignments })
    .from(habitAssignments)
    .innerJoin(habits, eq(habitAssignments.habitId, habits.id))
    .where(and(eq(habitAssignments.clientId, clientId), eq(habitAssignments.active, true), eq(habits.deleted, false)));
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

export async function getHabitCompletionsForCoach(clientId: number, fromDate?: string) {
  return getHabitCompletionsForClient(clientId, fromDate);
}
