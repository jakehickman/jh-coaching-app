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

function dateColToStr(v: Date | string | unknown): string {
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth()+1).padStart(2,'0')}-${String(v.getUTCDate()).padStart(2,'0')}`;
  }
  return String(v).slice(0, 10);
}

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

export async function markCheckInReviewed(id: number, reviewed: boolean) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(checkInSubmissions)
    .set({ reviewedAt: reviewed ? new Date() : null, updatedAt: new Date() })
    .where(eq(checkInSubmissions.id, id));
}

export async function saveCheckInCoachNotes(submissionId: number, notes: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(checkInSubmissions)
    .set({ coachNotes: notes, updatedAt: new Date() })
    .where(eq(checkInSubmissions.id, submissionId));
}

export async function saveCheckInChangesNotes(submissionId: number, notes: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(checkInSubmissions)
    .set({ changesNotes: notes, updatedAt: new Date() })
    .where(eq(checkInSubmissions.id, submissionId));
}

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

export async function deleteCheckIn(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(checkInSubmissions).where(eq(checkInSubmissions.id, id));
}

export function deriveCycleStatus(cycle: CheckInCycle, today: string): "upcoming" | "overdue" | "submitted" {
  if (cycle.status === "submitted") return "submitted";
  const dueDateStr = dateColToStr(cycle.dueDate);
  return today > dueDateStr ? "overdue" : "upcoming";
}

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

export async function getAllActiveCycles(): Promise<CheckInCycle[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(checkInCycles);
}

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

export async function skipCycle(clientId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const cycle = await getActiveCycle(clientId);
  if (!cycle) return;

  const dueDateStr = dateColToStr(cycle.dueDate);

  // Archive to history as skipped
  await db.insert(checkInHistory).values({
    clientId,
    dueDate: dueDateStr as any,
    submissionId: null,
    skipped: true,
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

export async function listCheckInQuestions(): Promise<CheckInQuestion[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(checkInQuestions)
    .orderBy(asc(checkInQuestions.displayOrder), asc(checkInQuestions.id));
}

export async function listActiveCheckInQuestions(): Promise<CheckInQuestion[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(checkInQuestions)
    .where(eq(checkInQuestions.active, true))
    .orderBy(asc(checkInQuestions.displayOrder), asc(checkInQuestions.id));
}

export async function upsertCheckInQuestion(data: {
  id?: number;
  slug: string;
  questionText: string;
  type: "single_choice" | "free_text";
  options?: string[] | null;
  displayOrder: number;
  active?: boolean;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  if (data.id) {
    await db
      .update(checkInQuestions)
      .set({
        slug: data.slug,
        questionText: data.questionText,
        type: data.type,
        options: data.options ?? null,
        displayOrder: data.displayOrder,
        active: data.active ?? true,
      })
      .where(eq(checkInQuestions.id, data.id));
  } else {
    await db.insert(checkInQuestions).values({
      slug: data.slug,
      questionText: data.questionText,
      type: data.type,
      options: data.options ?? null,
      displayOrder: data.displayOrder,
      active: data.active ?? true,
    });
  }
}

export async function toggleCheckInQuestion(id: number, active: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(checkInQuestions).set({ active }).where(eq(checkInQuestions.id, id));
}

export async function deleteCheckInQuestion(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Delete answers for this question first
  await db.delete(checkInAnswers).where(eq(checkInAnswers.questionId, id));
  await db.delete(checkInQuestions).where(eq(checkInQuestions.id, id));
}

export async function reorderCheckInQuestions(orderedIds: number[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(checkInQuestions)
      .set({ displayOrder: i + 1 })
      .where(eq(checkInQuestions.id, orderedIds[i]));
  }
}

export async function getAnswersForSubmission(
  submissionId: number
): Promise<(CheckInAnswer & { question: CheckInQuestion })[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: checkInAnswers.id,
      submissionId: checkInAnswers.submissionId,
      questionId: checkInAnswers.questionId,
      value: checkInAnswers.value,
      elaboration: checkInAnswers.elaboration,
      createdAt: checkInAnswers.createdAt,
      updatedAt: checkInAnswers.updatedAt,
      question: checkInQuestions,
    })
    .from(checkInAnswers)
    .innerJoin(checkInQuestions, eq(checkInAnswers.questionId, checkInQuestions.id))
    .where(eq(checkInAnswers.submissionId, submissionId))
    .orderBy(asc(checkInQuestions.displayOrder));
  return rows as (CheckInAnswer & { question: CheckInQuestion })[];
}

export async function saveCheckInAnswers(
  submissionId: number,
  answers: { questionId: number; value: string | null; elaboration?: string | null }[]
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Delete existing answers for this submission then re-insert
  await db.delete(checkInAnswers).where(eq(checkInAnswers.submissionId, submissionId));
  if (answers.length === 0) return;
  await db.insert(checkInAnswers).values(
    answers.map((a) => ({
      submissionId,
      questionId: a.questionId,
      value: a.value,
      elaboration: a.elaboration ?? null,
    }))
  );
}

export async function getClientQuestionOverrides(
  clientId: number
): Promise<ClientQuestionOverride[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clientQuestionOverrides)
    .where(eq(clientQuestionOverrides.clientId, clientId));
}

export async function setClientQuestionOverride(
  clientId: number,
  questionId: number,
  active: boolean
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(clientQuestionOverrides)
    .values({ clientId, questionId, active })
    .onDuplicateKeyUpdate({ set: { active } });
}

export async function deleteClientQuestionOverride(
  clientId: number,
  questionId: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(clientQuestionOverrides)
    .where(
      and(
        eq(clientQuestionOverrides.clientId, clientId),
        eq(clientQuestionOverrides.questionId, questionId)
      )
    );
}

export async function getActiveQuestionsForClient(
  clientId: number
): Promise<CheckInQuestion[]> {
  const db = await getDb();
  if (!db) return [];
  const [allQuestions, overrides] = await Promise.all([
    db
      .select()
      .from(checkInQuestions)
      .orderBy(asc(checkInQuestions.displayOrder)),
    getClientQuestionOverrides(clientId),
  ]);
  const overrideMap = new Map(overrides.map((o) => [o.questionId, o.active]));
  return allQuestions.filter((q) => {
    if (overrideMap.has(q.id)) return overrideMap.get(q.id)!;
    return q.active;
  });
}
