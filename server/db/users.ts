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
    const isOwner =
      user.openId === ENV.ownerOpenId ||
      (!!ENV.ownerEmail &&
        !!user.email &&
        user.email.toLowerCase() === ENV.ownerEmail);
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (isOwner) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    // Auto-approve admins/owner
    if (isOwner || user.role === "admin") {
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

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function relinkUserOpenId(userId: number, newOpenId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ openId: newOpenId }).where(eq(users.id, userId));
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
