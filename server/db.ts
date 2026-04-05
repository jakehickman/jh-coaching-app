import { eq, desc, and, gte, lte } from "drizzle-orm";
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
  showDate?: string;
  notes?: string;
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

export async function addMeasurement(data: {
  userId: number;
  measureDate: string;
  weight?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  leftArm?: number;
  rightArm?: number;
  leftThigh?: number;
  rightThigh?: number;
  leftCalf?: number;
  rightCalf?: number;
  neck?: number;
  shoulders?: number;
  bodyFatPercent?: number;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(measurements).values(data as any);
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
  notes?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await getMealPlan(data.userId, data.dayType);
  if (existing) {
    await db
      .update(mealPlans)
      .set({ ...data, updatedAt: new Date() } as any)
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
  programName?: string;
  days?: unknown;
  schedule?: unknown;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await getTrainingProgram(data.userId);
  if (existing) {
    await db
      .update(trainingPrograms)
      .set({ ...data, updatedAt: new Date() } as any)
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
    await db.update(exerciseLibrary).set({ ...rest, updatedAt: new Date() } as any).where(eq(exerciseLibrary.id, id));
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
    await db.update(nutritionFoods).set({ ...rest, updatedAt: new Date() } as any).where(eq(nutritionFoods.id, id));
  } else {
    await db.insert(nutritionFoods).values(data as any);
  }
}

export async function deleteNutritionFood(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(nutritionFoods).where(eq(nutritionFoods.id, id));
}
