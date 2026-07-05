import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { adminProcedure } from "./shared";
import * as db from "../db";

export const trainingRouter = router({
  get: protectedProcedure.query(async ({ ctx }) =>
    (await db.getTrainingProgram(ctx.user.id)) ?? null
  ),
  getForClient: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => (await db.getTrainingProgram(input.userId)) ?? null),
  upsert: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        programName: z.string().nullable().optional(),
        days: z.any().optional(),
        schedule: z.any().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Diff before saving so we can record what changed
      if (input.days) {
        const existing = await db.getTrainingProgram(input.userId);
        const oldDays = (existing?.days as any[]) ?? [];
        const newDays = input.days as any[];
        const changes = db.diffTrainingPrograms(oldDays, newDays);
        if (changes.length > 0) {
          await db.insertProgramChangeLog({
            userId: input.userId,
            coachId: ctx.user.id,
            changes,
          });
        }
      }
      return db.upsertTrainingProgram({ coachId: ctx.user.id, ...input });
    }),
  getChangeLogs: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => db.getProgramChangeLogs(input.userId)),
  updateChangeLogNote: adminProcedure
    .input(z.object({ id: z.number(), note: z.string().nullable() }))
    .mutation(({ input }) => db.updateProgramChangeLogNote(input.id, input.note)),
  deleteChangeLogEntry: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteChangeLogEntry(input.id)),
  listAll: adminProcedure.query(() => db.listAllTrainingPrograms()),
});

export const mesoRouter = router({
  // Legacy client-facing queries (kept for backward compat)
  cycles: protectedProcedure.query(({ ctx }) => db.getMesoCycles(ctx.user.id)),

  // Coach: list all mesocycles for a client
  cyclesForClient: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => db.getMesoCycles(input.userId)),

  // Coach: create a new mesocycle for a client
  create: adminProcedure
    .input(z.object({
      userId: z.number(),
      mesoName: z.string(),
      startDate: z.string(), // YYYY-MM-DD
      notes: z.string().nullable().optional(),
    }))
    .mutation(({ ctx, input }) => db.createMesoCycle({
      userId: input.userId,
      coachId: ctx.user.id,
      mesoName: input.mesoName,
      startDate: input.startDate,
      notes: input.notes ?? null,
    })),

  // Coach: close (archive) a mesocycle
  close: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.closeMesoCycle(input.id)),

  // Coach: delete a mesocycle
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteMesoCycle(input.id)),

  // Coach: get the mesocycle review table data
  // Returns exercises grouped by session, with top-set per microcycle
  review: adminProcedure
    .input(z.object({ mesoId: z.number(), userId: z.number() }))
    .query(({ input }) => db.getMesoCycleReview(input.mesoId, input.userId)),
});

export const workoutSessionsRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.listWorkoutSessions(ctx.user.id)),
  listForClient: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => db.listWorkoutSessions(input.userId)),
  save: protectedProcedure
    .input(
      z.object({
        sessionDate: z.string(),
        dayLabel: z.string(),
        exercises: z.array(
          z.object({
            name: z.string(),
            substitutedFor: z.string().nullable().optional(),
            equipmentDetails: z.string().nullable().optional(),
            machinePreset: z.string().nullable().optional(),
            machineSettings: z.string().nullable().optional(),
            exerciseNotes: z.string().nullable().optional(),
            weightUnit: z.enum(['kg', 'lbs']).optional(),
            sets: z.array(
              z.object({
                weight: z.number().nullable().optional(),
                reps: z.number().nullable().optional(),
                notes: z.string().nullable().optional(),
                completed: z.boolean().optional(),
                myoReps: z.boolean().optional(),
                miniSets: z.number().nullable().optional(),
              })
            ),
          })
        ),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(({ ctx, input }) => db.saveWorkoutSession({ userId: ctx.user.id, ...input })),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => db.deleteWorkoutSession(input.id, ctx.user.id)),
  // Coach: patch machinePreset/machineSettings on a specific exercise in a past session
  patchExercisePreset: adminProcedure
    .input(z.object({
      sessionId: z.number(),
      userId: z.number(),
      exerciseName: z.string(),
      machinePreset: z.string().nullable().optional(),
      machineSettings: z.string().nullable().optional(),
    }))
    .mutation(({ input }) => db.patchWorkoutSessionExercisePreset(input.sessionId, input.userId, input.exerciseName, input.machinePreset ?? null, input.machineSettings ?? null)),
  updateDate: protectedProcedure
    .input(z.object({ id: z.number(), sessionDate: z.string() }))
    .mutation(({ ctx, input }) => db.updateWorkoutSessionDate(input.id, ctx.user.id, input.sessionDate)),
});

export const equipmentPresetsRouter = router({
  list: protectedProcedure
    .input(z.object({ exerciseName: z.string() }))
    .query(({ ctx, input }) => db.getEquipmentPresets(ctx.user.id, input.exerciseName)),
  listAll: protectedProcedure
    .query(({ ctx }) => db.getAllEquipmentPresets(ctx.user.id)),
  upsert: protectedProcedure
    .input(z.object({ exerciseName: z.string(), presetName: z.string(), lastSettings: z.string().nullable().optional() }))
    .mutation(({ ctx, input }) => db.upsertEquipmentPreset(ctx.user.id, input.exerciseName, input.presetName, input.lastSettings)),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => db.deleteEquipmentPreset(ctx.user.id, input.id)),
  rename: protectedProcedure
    .input(z.object({ id: z.number(), newName: z.string().min(1) }))
    .mutation(({ ctx, input }) => db.renameEquipmentPreset(ctx.user.id, input.id, input.newName)),
  // ─── Coach/admin procedures scoped to a target client ───────────────────────
  listForClient: adminProcedure
    .input(z.object({ userId: z.number(), exerciseName: z.string() }))
    .query(({ input }) => db.getEquipmentPresets(input.userId, input.exerciseName)),
  upsertForClient: adminProcedure
    .input(z.object({ userId: z.number(), exerciseName: z.string(), presetName: z.string(), lastSettings: z.string().nullable().optional() }))
    .mutation(({ input }) => db.upsertEquipmentPreset(input.userId, input.exerciseName, input.presetName, input.lastSettings)),
  deleteForClient: adminProcedure
    .input(z.object({ userId: z.number(), id: z.number() }))
    .mutation(({ input }) => db.deleteEquipmentPreset(input.userId, input.id)),
  renameForClient: adminProcedure
    .input(z.object({ userId: z.number(), id: z.number(), newName: z.string().min(1) }))
    .mutation(({ input }) => db.renameEquipmentPreset(input.userId, input.id, input.newName)),
});

export const exerciseLibraryRouter = router({
  list: protectedProcedure.query(() => db.listExercises()),
  upsert: adminProcedure
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string(),
        chest: z.number().optional(),
        frontDelts: z.number().optional(),
        sideDelts: z.number().optional(),
        triceps: z.number().optional(),
        lats: z.number().optional(),
        upperBack: z.number().optional(),
        rearDelts: z.number().optional(),
        biceps: z.number().optional(),
        quads: z.number().optional(),
        hams: z.number().optional(),
        glutes: z.number().optional(),
        gluteMed: z.number().optional(),
        calves: z.number().optional(),
        abs: z.number().optional(),
        customGroups: z.any().optional(),
        videoUrl: z.string().nullish(),
      })
    )
    .mutation(({ input }) => db.upsertExercise(input as any)),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteExercise(input.id)),
});
