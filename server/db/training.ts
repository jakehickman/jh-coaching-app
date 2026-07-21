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

export function diffTrainingPrograms(
  oldDays: TrainingDay[],
  newDays: TrainingDay[]
): ProgramChangeEntry[] {
  const changes: ProgramChangeEntry[] = [];

  const oldMap = new Map(oldDays.map(d => [d.name, d]));
  const newMap = new Map(newDays.map(d => [d.name, d]));

  // Sessions added
  for (const [name] of Array.from(newMap)) {
    if (!oldMap.has(name)) {
      const day = newMap.get(name)!;
      for (const ex of day.exercises) {
        changes.push({ type: "add", session: name, exercise: ex.name });
      }
    }
  }

  // Sessions removed
  for (const [name] of Array.from(oldMap)) {
    if (!newMap.has(name)) {
      const day = oldMap.get(name)!;
      for (const ex of day.exercises) {
        changes.push({ type: "remove", session: name, exercise: ex.name });
      }
    }
  }

  // Sessions in both — diff exercises
  for (const [name, newDay] of Array.from(newMap)) {
    const oldDay = oldMap.get(name);
    if (!oldDay) continue;

    const oldExMap = new Map(oldDay.exercises.map(e => [e.name, e]));
    const newExMap = new Map(newDay.exercises.map(e => [e.name, e]));

    // Exercises added
    for (const [exName] of Array.from(newExMap)) {
      if (!oldExMap.has(exName)) {
        changes.push({ type: "add", session: name, exercise: exName });
      }
    }

    // Exercises removed
    for (const [exName] of Array.from(oldExMap)) {
      if (!newExMap.has(exName)) {
        changes.push({ type: "remove", session: name, exercise: exName });
      }
    }

    // Exercises in both — diff fields
    for (const [exName, newEx] of Array.from(newExMap)) {
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

  // Check if a row already exists for this user on today's calendar date (UTC date)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  const [existing] = await db
    .select()
    .from(programChangeLogs)
    .where(
      and(
        eq(programChangeLogs.userId, data.userId),
        gte(programChangeLogs.changedAt, todayStart),
        lt(programChangeLogs.changedAt, tomorrowStart)
      )
    )
    .limit(1);

  if (existing) {
    // Merge new changes into the existing row
    const merged: ProgramChangeEntry[] = [
      ...(Array.isArray(existing.changes) ? existing.changes : []),
      ...data.changes,
    ];
    await db
      .update(programChangeLogs)
      .set({ changes: merged as any })
      .where(eq(programChangeLogs.id, existing.id));
  } else {
    await db.insert(programChangeLogs).values({
      userId: data.userId,
      coachId: data.coachId ?? null,
      changes: data.changes,
    } as any);
  }
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

export async function updateProgramChangeLogNote(id: number, note: string | null) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(programChangeLogs)
    .set({ note })
    .where(eq(programChangeLogs.id, id));
}

export async function deleteChangeLogEntry(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(programChangeLogs).where(eq(programChangeLogs.id, id));
}

export async function listAllTrainingPrograms() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trainingPrograms);
}

export async function getMesoCycles(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(mesoCycles)
    .where(eq(mesoCycles.userId, userId))
    .orderBy(desc(mesoCycles.createdAt));
}

export async function createMesoCycle(data: {
  userId: number;
  coachId: number;
  mesoName: string;
  startDate: string;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(mesoCycles).values(data as any);
  return (result as any).insertId as number;
}

export async function closeMesoCycle(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(mesoCycles).set({ closedAt: new Date() } as any).where(eq(mesoCycles.id, id));
}

export async function deleteMesoCycle(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(mesoCycles).where(eq(mesoCycles.id, id));
}

export async function getMesoCycleReview(mesoId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;

  // 1. Load the meso
  const mesoRows = await db.select().from(mesoCycles).where(eq(mesoCycles.id, mesoId)).limit(1);
  const meso = mesoRows[0];
  if (!meso) return null;

  // 2. Load all workout sessions for this client on/after startDate, oldest first
  const sessions = await db
    .select()
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, userId),
        gte(workoutSessions.sessionDate, meso.startDate as any)
      )
    )
    .orderBy(workoutSessions.sessionDate, workoutSessions.createdAt);

  // 3. Load training program to get schedule order
  const program = await getTrainingProgram(userId);
  const schedule: string[] = (program as any)?.schedule ?? [];
  const trainingDays = schedule.filter((s: string) => s.toUpperCase() !== 'OFF');
  // Unique ordered day labels from the schedule (preserving order of first appearance)
  const dayOrder: string[] = [];
  for (const d of trainingDays) {
    if (!dayOrder.includes(d)) dayOrder.push(d);
  }
  const rotationLength = dayOrder.length || 1;

  // 4. Group sessions into microcycles
  // A microcycle = one complete pass through all training day labels in schedule order
  // We assign each session a microcycle number based on how many complete rotations
  // have occurred before it (counting by day label sequence)
  // Strategy: sort sessions by date, then assign microcycle by counting how many
  // times each day label has appeared
  const dayCount: Record<string, number> = {};
  for (const d of dayOrder) dayCount[d] = 0;

  interface SessionEntry {
    sessionId: number;
    sessionDate: string;
    dayLabel: string;
    microNum: number;
    exercises: WorkoutExercise[];
  }
  const sessionEntries: SessionEntry[] = [];

  for (const s of sessions) {
    const label = s.dayLabel;
    // Normalize label: strip extra info after first word boundary if needed
    // Match against dayOrder by checking if any dayOrder entry is a prefix/match
    const matchedDay = dayOrder.find(d =>
      label === d ||
      label.startsWith(d + ' ') ||
      label.startsWith(d + '-') ||
      label.toLowerCase() === d.toLowerCase()
    ) ?? label;

    if (!(matchedDay in dayCount)) {
      dayCount[matchedDay] = 0;
    }
    dayCount[matchedDay]++;
    const microNum = dayCount[matchedDay];

    sessionEntries.push({
      sessionId: s.id,
      sessionDate: s.sessionDate as unknown as string,
      dayLabel: label,
      microNum,
      exercises: (s.exercises as WorkoutExercise[]) ?? [],
    });
  }

  // 5. Build review structure: per dayLabel, per exercise, per microcycle
  // Group by dayLabel (in schedule order)
  const allDayLabels = Array.from(new Set(sessionEntries.map(s => s.dayLabel)));
  // Sort by schedule order
  const sortedDayLabels = [
    ...dayOrder.filter(d => allDayLabels.some(l => l === d || l.startsWith(d))),
    ...allDayLabels.filter(l => !dayOrder.some(d => l === d || l.startsWith(d))),
  ];

  // Max microcycles seen
  const maxMicro = Math.max(0, ...sessionEntries.map(s => s.microNum));

  interface TopSetEntry {
    microNum: number;
    sessionDate: string;
    topSet: { weight: number | null; reps: number | null } | null;
    totalSets: number;
    machinePreset: string | null;
    weightUnit: string | null;
  }

  interface ExerciseReview {
    exerciseName: string;
    microcycles: TopSetEntry[];
  }

  interface DayReview {
    dayLabel: string;
    exercises: ExerciseReview[];
    /** Exercise names in current program order for this day (empty if day not in program) */
    programExerciseOrder: string[];
  }

  const dayReviews: DayReview[] = [];

  // Build a map of day label -> current program exercise order
  const programDays: TrainingDay[] = (program as any)?.days ?? [];
  const programExOrderByDay: Record<string, string[]> = {};
  for (const pd of programDays) {
    programExOrderByDay[pd.name] = pd.exercises.map((e: TrainingExercise) => e.name);
  }

  for (const dayLabel of sortedDayLabels) {
    const daySessions = sessionEntries.filter(s =>
      s.dayLabel === dayLabel ||
      dayOrder.some(d => s.dayLabel.startsWith(d) && dayLabel.startsWith(d))
    );

    // Current program exercise order for this day
    const matchedProgramDay = Object.keys(programExOrderByDay).find(k =>
      k === dayLabel || dayLabel.startsWith(k) || k.startsWith(dayLabel)
    );
    const programExerciseOrder: string[] = matchedProgramDay ? programExOrderByDay[matchedProgramDay] : [];

    // Collect all exercise names seen in this day across all microcycles
    const exNames: string[] = [];
    for (const s of daySessions) {
      for (const ex of s.exercises) {
        if (!exNames.includes(ex.name)) exNames.push(ex.name);
      }
    }

    const exerciseReviews: ExerciseReview[] = exNames.map(exName => {
      const microcycles: TopSetEntry[] = [];
      for (let micro = 1; micro <= Math.min(maxMicro, 8); micro++) {
        const session = daySessions.find(s => s.microNum === micro);
        if (!session) {
          microcycles.push({ microNum: micro, sessionDate: '', topSet: null, totalSets: 0, machinePreset: null, weightUnit: null });
          continue;
        }
        const ex = session.exercises.find(e => e.name === exName);
        if (!ex) {
          microcycles.push({ microNum: micro, sessionDate: session.sessionDate, topSet: null, totalSets: 0, machinePreset: null, weightUnit: null });
          continue;
        }
        const completedSets = (ex.sets ?? []).filter(s => s.completed || s.weight != null || s.reps != null);
        const topSet = completedSets.reduce<{ weight: number | null; reps: number | null } | null>((best, s) => {
          if (!best) return { weight: s.weight ?? null, reps: s.reps ?? null };
          const bw = best.weight ?? 0, sw = s.weight ?? 0;
          if (sw > bw) return { weight: s.weight ?? null, reps: s.reps ?? null };
          if (sw === bw && (s.reps ?? 0) > (best.reps ?? 0)) return { weight: s.weight ?? null, reps: s.reps ?? null };
          return best;
        }, null);
        microcycles.push({
          microNum: micro,
          sessionDate: session.sessionDate,
          topSet,
          totalSets: completedSets.length,
          machinePreset: ex?.machinePreset ?? null,
          weightUnit: (ex as any).weightUnit ?? null,
        });
      }
      return { exerciseName: exName, microcycles };
    });

    dayReviews.push({ dayLabel, exercises: exerciseReviews, programExerciseOrder });
  }

  return {
    meso: {
      id: meso.id,
      mesoName: meso.mesoName,
      startDate: meso.startDate as unknown as string,
      closedAt: meso.closedAt,
      notes: meso.notes,
    },
    maxMicro: Math.min(maxMicro, 8),
    dayReviews,
  };
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

export async function getCardioChangeLogs(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(cardioChangeLogs)
    .where(eq(cardioChangeLogs.userId, userId))
    .orderBy(cardioChangeLogs.changedAt);
}

export async function updateCardioChangeLogNote(id: number, note: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(cardioChangeLogs).set({ note }).where(eq(cardioChangeLogs.id, id));
}

export async function deleteCardioChangeLog(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(cardioChangeLogs).where(eq(cardioChangeLogs.id, id));
}
