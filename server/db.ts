import { eq, desc, asc, and, gte, lt, sql } from "drizzle-orm";
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
  TrainingDay,
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
  const rows = await db
    .select()
    .from(clientProfiles)
    .where(eq(clientProfiles.coachId, coachId));
  // Deduplicate by userId — keep the first (oldest) profile per user
  const seen = new Set<number>();
  return rows.filter(r => {
    if (seen.has(r.userId)) return false;
    seen.add(r.userId);
    return true;
  });
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      role: users.role,
      approved: users.approved,
      loginMethod: users.loginMethod,
      lastSignedIn: users.lastSignedIn,
      createdAt: users.createdAt,
      displayName: clientProfiles.displayName,
      checkInDay: clientProfiles.checkInDay,
      startDate: clientProfiles.startDate,
    })
    .from(users)
    .leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
    .orderBy(desc(users.createdAt));
  // Deduplicate by userId (leftJoin can produce multiple rows if a user has duplicate profile rows)
  const seen = new Set<number>();
  const deduped = rows.filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  // Expose a resolved `name` that prefers clientProfile.displayName over OAuth name
  return deduped.map(r => ({
    ...r,
    name: r.displayName || r.name || null,
  }));
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
  // Delete all related data first to avoid FK constraint errors and orphaned rows
  await db.delete(dailyLogs).where(eq(dailyLogs.userId, userId));
  await db.delete(measurements).where(eq(measurements.userId, userId));
  await db.delete(mealPlans).where(eq(mealPlans.userId, userId));
  await db.delete(shoppingItems).where(eq(shoppingItems.userId, userId));
  // meso sessions depend on meso cycles — delete sessions first
  const userMesos = await db.select({ id: mesoCycles.id }).from(mesoCycles).where(eq(mesoCycles.userId, userId));
  for (const meso of userMesos) {
    await db.delete(mesoSessions).where(eq(mesoSessions.mesoId, meso.id));
  }
  await db.delete(mesoCycles).where(eq(mesoCycles.userId, userId));
  await db.delete(trainingPrograms).where(eq(trainingPrograms.userId, userId));
  await db.delete(workoutSessions).where(eq(workoutSessions.userId, userId));
  await db.delete(timelineMilestones).where(eq(timelineMilestones.userId, userId));
  await db.delete(coachingNotes).where(eq(coachingNotes.clientId, userId));
  await db.delete(weeklyCheckIns).where(eq(weeklyCheckIns.userId, userId));
  await db.delete(checkInSubmissions).where(eq(checkInSubmissions.clientId, userId));
  await db.delete(onboardingSubmissions).where(eq(onboardingSubmissions.userId, userId));
  await db.delete(habitAssignments).where(eq(habitAssignments.clientId, userId));
  await db.delete(habitCompletions).where(eq(habitCompletions.clientId, userId));
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
  offPlanMeals?: number;
  notes?: string;
  force?: boolean; // if true, bypass the trainingCompleted guard (used by deleteWorkoutSession)
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await getDailyLogByDate(data.userId, data.logDate);
  if (existing) {
    // Never overwrite a workout-synced trainingCompleted=true with false from the daily log form.
    // Only allow trainingCompleted to change if the caller is explicitly setting it to true,
    // if the existing value is already false, or if force=true (e.g. deleteWorkoutSession).
    const updatePayload = { ...data };
    if (!data.force && existing.trainingCompleted && updatePayload.trainingCompleted === false) {
      delete updatePayload.trainingCompleted;
      delete updatePayload.trainingType;
    }
    delete updatePayload.force;
    await db
      .update(dailyLogs)
      .set({ ...updatePayload, updatedAt: new Date() } as any)
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
  treatAllowanceKcal?: number | null;
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

export async function getMealPlanHistory(userId: number): Promise<MealPlanHistoryRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(mealPlanHistory)
    .where(eq(mealPlanHistory.userId, userId))
    .orderBy(desc(mealPlanHistory.changedAt));
}

export async function insertMealPlanHistorySnapshot(data: {
  userId: number;
  coachId?: number;
  trainingCalories?: number | null;
  trainingProtein?: number | null;
  trainingCarbs?: number | null;
  trainingFat?: number | null;
  restCalories?: number | null;
  restProtein?: number | null;
  restCarbs?: number | null;
  restFat?: number | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(mealPlanHistory).values(data as any);
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

// ─── Program change log helpers ─────────────────────────────────────────────

export function diffTrainingPrograms(
  oldDays: TrainingDay[],
  newDays: TrainingDay[]
): ProgramChangeEntry[] {
  const changes: ProgramChangeEntry[] = [];

  const oldMap = new Map(oldDays.map(d => [d.name, d]));
  const newMap = new Map(newDays.map(d => [d.name, d]));

  // Sessions added
  for (const [name] of newMap) {
    if (!oldMap.has(name)) {
      const day = newMap.get(name)!;
      for (const ex of day.exercises) {
        changes.push({ type: "add", session: name, exercise: ex.name });
      }
    }
  }

  // Sessions removed
  for (const [name] of oldMap) {
    if (!newMap.has(name)) {
      const day = oldMap.get(name)!;
      for (const ex of day.exercises) {
        changes.push({ type: "remove", session: name, exercise: ex.name });
      }
    }
  }

  // Sessions in both — diff exercises
  for (const [name, newDay] of newMap) {
    const oldDay = oldMap.get(name);
    if (!oldDay) continue;

    const oldExMap = new Map(oldDay.exercises.map(e => [e.name, e]));
    const newExMap = new Map(newDay.exercises.map(e => [e.name, e]));

    // Exercises added
    for (const [exName] of newExMap) {
      if (!oldExMap.has(exName)) {
        changes.push({ type: "add", session: name, exercise: exName });
      }
    }

    // Exercises removed
    for (const [exName] of oldExMap) {
      if (!newExMap.has(exName)) {
        changes.push({ type: "remove", session: name, exercise: exName });
      }
    }

    // Exercises in both — diff fields
    for (const [exName, newEx] of newExMap) {
      const oldEx = oldExMap.get(exName);
      if (!oldEx) continue;
      const fields: Array<keyof typeof oldEx> = ["sets", "reps", "notes"];
      for (const field of fields) {
        const ov = (oldEx[field] ?? "").toString().trim();
        const nv = (newEx[field] ?? "").toString().trim();
        if (ov !== nv) {
          changes.push({
            type: "modify",
            session: name,
            exercise: exName,
            field: field as string,
            oldValue: ov || undefined,
            newValue: nv || undefined,
          });
        }
      }
    }
  }

  return changes;
}

export async function insertProgramChangeLog(data: {
  userId: number;
  coachId?: number;
  changes: ProgramChangeEntry[];
}) {
  const db = await getDb();
  if (!db || data.changes.length === 0) return;
  await db.insert(programChangeLogs).values({
    userId: data.userId,
    coachId: data.coachId ?? null,
    changes: data.changes,
  } as any);
}

export async function getProgramChangeLogs(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(programChangeLogs)
    .where(eq(programChangeLogs.userId, userId))
    .orderBy(programChangeLogs.changedAt);
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
  // Always sync trainingCompleted = true to the daily log for this date
  await upsertDailyLog({
    userId: data.userId,
    logDate: data.sessionDate,
    trainingCompleted: true,
    trainingType: data.dayLabel,
  });
  return existing.length > 0 ? existing[0].id : undefined;
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

// ─── Check-in Submissions ────────────────────────────────────────────────────

export async function submitCheckIn(data: {
  clientId: number;
  coachId?: number;
  weekStartDate: string;
  // Section 1: Diet Execution (6 questions)
  dietWeighedFoods?: "every_meal" | "most_meals" | "some_meals" | "rarely" | "never";
  dietMealPrepAccuracy?: "every_meal" | "most_meals" | "some_meals" | "rarely" | "never";
  dietExtrasFrequency?: "never" | "one_two_days" | "few_days" | "most_days" | "every_day";
  dietAddedFats?: "light_spray" | "small_amount" | "one_tsp_or_more" | "no_added_fats";
  dietMealTiming?: "never" | "one_two_days" | "few_days" | "most_days" | "every_day";
  dietOffPlanQuality?: "very_close" | "somewhat_close" | "not_very_close" | "very_different" | "no_off_plan_meals";

  // Section 2: Adherence Barrier
  adherenceBarrier?: "no_issues" | "hunger" | "cravings" | "social_events" | "busy_time" | "poor_planning" | "low_motivation" | "travel_disruption" | "other";
  barrierExplain?: string;
  // Section 3: Weekly Self-Assessment
  weeklyAssessment?: "executed_exactly" | "mostly_followed" | "inconsistent" | "didnt_follow";
  // Section 4: Focus for Next Week

}) {
  const db = await getDb();
  if (!db) return null;
  // Upsert: one submission per client per week
  const existing = await db
    .select()
    .from(checkInSubmissions)
    .where(
      and(
        eq(checkInSubmissions.clientId, data.clientId),
        eq(checkInSubmissions.weekStartDate, data.weekStartDate as any)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(checkInSubmissions)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(checkInSubmissions.id, existing[0].id));
    return existing[0].id;
  } else {
    const [result] = await db.insert(checkInSubmissions).values(data as any);
    return (result as any)?.insertId ?? null;
  }
}

export async function listCheckInsForClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(checkInSubmissions)
    .where(eq(checkInSubmissions.clientId, clientId))
    .orderBy(desc(checkInSubmissions.weekStartDate));
}

export async function getCheckInForWeek(clientId: number, weekStartDate: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(checkInSubmissions)
    .where(
      and(
        eq(checkInSubmissions.clientId, clientId),
        eq(checkInSubmissions.weekStartDate, weekStartDate as any)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

// Coach: mark a check-in as reviewed or unreviewed
export async function markCheckInReviewed(id: number, reviewed: boolean) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(checkInSubmissions)
    .set({ reviewedAt: reviewed ? new Date() : null, updatedAt: new Date() })
    .where(eq(checkInSubmissions.id, id));
}

// Coach: save notes on a check-in submission
export async function saveCheckInCoachNotes(submissionId: number, notes: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(checkInSubmissions)
    .set({ coachNotes: notes, updatedAt: new Date() })
    .where(eq(checkInSubmissions.id, submissionId));
}

// Coach: save changes-made notes on a check-in submission
export async function saveCheckInChangesNotes(submissionId: number, notes: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(checkInSubmissions)
    .set({ changesNotes: notes, updatedAt: new Date() })
    .where(eq(checkInSubmissions.id, submissionId));
}

// Coach: get the most recent check-in week for each client (for indicator badges)
export async function getLatestCheckInPerClient(): Promise<{ clientId: number; weekStartDate: string; submittedAt: Date; reviewedAt: Date | null }[]> {
  const db = await getDb();
  if (!db) return [];
  // Get the most recent check-in row per clientId
  const rows = await db
    .select({
      clientId: checkInSubmissions.clientId,
      weekStartDate: checkInSubmissions.weekStartDate,
      submittedAt: checkInSubmissions.submittedAt,
      reviewedAt: checkInSubmissions.reviewedAt,
    })
    .from(checkInSubmissions)
    .orderBy(desc(checkInSubmissions.submittedAt));
  // Keep only the latest per clientId
  const seen = new Set<number>();
  return rows.filter(r => {
    if (seen.has(r.clientId)) return false;
    seen.add(r.clientId);
    return true;
  }).map(r => ({ clientId: r.clientId, weekStartDate: String(r.weekStartDate), submittedAt: r.submittedAt as unknown as Date, reviewedAt: (r.reviewedAt as unknown as Date | null) ?? null }));
}

// Coach: get ALL check-in submissions per client (for overdue evaluation across all scheduled dates)
export async function getAllCheckInsPerClient(): Promise<{ clientId: number; submittedAt: Date; weekStartDate: string }[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      clientId: checkInSubmissions.clientId,
      submittedAt: checkInSubmissions.submittedAt,
      weekStartDate: checkInSubmissions.weekStartDate,
    })
    .from(checkInSubmissions)
    .orderBy(desc(checkInSubmissions.submittedAt));
  return rows.map(r => {
    const wsd = r.weekStartDate as unknown as Date | string;
    // MySQL date columns come back as JS Date objects from the driver; convert safely
    const weekStartDate = wsd instanceof Date
      ? `${wsd.getUTCFullYear()}-${String(wsd.getUTCMonth() + 1).padStart(2, '0')}-${String(wsd.getUTCDate()).padStart(2, '0')}`
      : String(wsd).slice(0, 10);
    return { clientId: r.clientId, submittedAt: r.submittedAt as unknown as Date, weekStartDate };
  });
}

// Coach: delete a check-in submission
export async function deleteCheckIn(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(checkInSubmissions).where(eq(checkInSubmissions.id, id));
}

// ─── Update check-in day ─────────────────────────────────────────────────────

export async function updateClientProfileExtended(userId: number, data: {
  checkInDay?: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday" | null;
  stepGoal?: number | null;
}, coachId?: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(clientProfiles).where(eq(clientProfiles.userId, userId)).limit(1);
  if (existing.length > 0) {
    // Also backfill coachId if it's missing
    const updateData: any = { ...data };
    if (coachId !== undefined && !existing[0].coachId) updateData.coachId = coachId;
    await db.update(clientProfiles).set(updateData).where(eq(clientProfiles.userId, userId));
  } else {
    await db.insert(clientProfiles).values({ userId, coachId, ...data } as any);
  }
}

// ─── Equipment Presets ────────────────────────────────────────────────────────

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

export async function upsertEquipmentPreset(userId: number, exerciseName: string, presetName: string, lastSettings?: string | null) {
  const db = await getDb();
  if (!db) return;
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
  } else {
    await db.insert(equipmentPresets).values({ userId, exerciseName, presetName, lastSettings: lastSettings ?? null });
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

// ─── New single-cycle check-in system ────────────────────────────────────────

/** Convert a MySQL date column value (Date object or string) to YYYY-MM-DD */
function dateColToStr(v: Date | string | unknown): string {
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth()+1).padStart(2,'0')}-${String(v.getUTCDate()).padStart(2,'0')}`;
  }
  return String(v).slice(0, 10);
}

/** Derive the display status from a stored cycle row and today's date string */
export function deriveCycleStatus(cycle: CheckInCycle, today: string): "upcoming" | "overdue" | "submitted" {
  if (cycle.status === "submitted") return "submitted";
  const dueDateStr = dateColToStr(cycle.dueDate);
  return today > dueDateStr ? "overdue" : "upcoming";
}

/** Get the active cycle for a client */
export async function getActiveCycle(clientId: number): Promise<CheckInCycle | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(checkInCycles)
    .where(eq(checkInCycles.clientId, clientId))
    .limit(1);
  return rows[0] ?? null;
}

/** Get all active cycles (one per client) for the coach dashboard */
export async function getAllActiveCycles(): Promise<CheckInCycle[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(checkInCycles);
}

/**
 * Client submits their check-in:
 * 1. Insert/upsert into check_in_submissions (preserves Q&A data)
 * 2. Update check_in_cycles: status='submitted', submissionId=<new id>
 */
export async function submitCycleCheckIn(data: {
  clientId: number;
  weekStartDate: string;
  dietWeighedFoods?: "every_meal" | "most_meals" | "some_meals" | "rarely" | "never";
  dietMealPrepAccuracy?: "every_meal" | "most_meals" | "some_meals" | "rarely" | "never";
  dietExtrasFrequency?: "never" | "one_two_days" | "few_days" | "most_days" | "every_day";
  dietAddedFats?: "light_spray" | "small_amount" | "one_tsp_or_more" | "no_added_fats";
  dietMealTiming?: "never" | "one_two_days" | "few_days" | "most_days" | "every_day";
  dietOffPlanQuality?: "very_close" | "somewhat_close" | "not_very_close" | "very_different" | "no_off_plan_meals";
  sleepBedtimeConsistency?: "never" | "one_two_days" | "few_days" | "most_days" | "every_day";
  adherenceBarrier?: "no_issues" | "hunger" | "cravings" | "social_events" | "busy_time" | "poor_planning" | "low_motivation" | "travel_disruption" | "other";
  barrierExplain?: string;
  weeklyAssessment?: "executed_exactly" | "mostly_followed" | "inconsistent" | "didnt_follow";
}): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  // Upsert submission (one per client per weekStartDate)
  const existing = await db
    .select()
    .from(checkInSubmissions)
    .where(and(
      eq(checkInSubmissions.clientId, data.clientId),
      eq(checkInSubmissions.weekStartDate, data.weekStartDate as any)
    ))
    .limit(1);

  let submissionId: number;
  if (existing.length > 0) {
    await db.update(checkInSubmissions)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(checkInSubmissions.id, existing[0].id));
    submissionId = existing[0].id;
  } else {
    const [result] = await db.insert(checkInSubmissions).values(data as any);
    submissionId = (result as any)?.insertId ?? null;
  }

  // Update the cycle to submitted
  await db.update(checkInCycles)
    .set({ status: "submitted", submissionId, updatedAt: new Date() })
    .where(eq(checkInCycles.clientId, data.clientId));

  return submissionId;
}

/**
 * Coach marks a cycle complete:
 * 1. Archive current cycle row to check_in_history
 * 2. Update the cycle: dueDate += 7, status='upcoming', submissionId=null
 */
export async function completeCycle(clientId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const cycle = await getActiveCycle(clientId);
  if (!cycle) return;

  const dueDateStr = dateColToStr(cycle.dueDate);

  // Archive to history
  await db.insert(checkInHistory).values({
    clientId,
    dueDate: dueDateStr as any,
    submissionId: cycle.submissionId ?? null,
    completedAt: new Date(),
  });

  // Advance: dueDate + 7, reset to upcoming
  const nextDue = new Date(dueDateStr + "T00:00:00Z");
  nextDue.setUTCDate(nextDue.getUTCDate() + 7);
  const nextDueStr = nextDue.toISOString().slice(0, 10);

  await db.update(checkInCycles)
    .set({ dueDate: nextDueStr as any, status: "upcoming", submissionId: null, updatedAt: new Date() })
    .where(eq(checkInCycles.clientId, clientId));
}

/** Get check-in history for a client (most recent first) */
export async function getCycleHistory(clientId: number): Promise<(CheckInHistoryRow & { submission: CheckInSubmission | null })[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(checkInHistory)
    .where(eq(checkInHistory.clientId, clientId))
    .orderBy(desc(checkInHistory.completedAt));

  // Enrich with submission data
  const result: (CheckInHistoryRow & { submission: CheckInSubmission | null })[] = [];
  for (const row of rows) {
    let submission: CheckInSubmission | null = null;
    if (row.submissionId) {
      const subs = await db
        .select()
        .from(checkInSubmissions)
        .where(eq(checkInSubmissions.id, row.submissionId))
        .limit(1);
      submission = (subs[0] as CheckInSubmission) ?? null;
    }
    result.push({ ...row, submission });
  }
  return result;
}

// ─── Progress Photos ─────────────────────────────────────────────────────────

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
