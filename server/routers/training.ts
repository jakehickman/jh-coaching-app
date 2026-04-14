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
    .mutation(({ ctx, input }) =>
      db.upsertTrainingProgram({ coachId: ctx.user.id, ...input })
    ),
  listAll: adminProcedure.query(() => db.listAllTrainingPrograms()),
});

export const mesoRouter = router({
  cycles: protectedProcedure.query(({ ctx }) => db.getMesoCycles(ctx.user.id)),
  cyclesForClient: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => db.getMesoCycles(input.userId)),
  sessions: protectedProcedure
    .input(z.object({ mesoId: z.number() }))
    .query(({ input }) => db.getMesoSessions(input.mesoId)),
  upsertSession: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        mesoId: z.number(),
        sessionDate: z.string().optional(),
        weekNumber: z.number().optional(),
        dayLabel: z.string().optional(),
        exercises: z.any().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      db.upsertMesoSession({ userId: ctx.user.id, ...input })
    ),
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
            sets: z.array(
              z.object({
                weight: z.number().nullable().optional(),
                reps: z.number().nullable().optional(),
                notes: z.string().nullable().optional(),
                completed: z.boolean().optional(),
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
});

export const equipmentPresetsRouter = router({
  list: protectedProcedure
    .input(z.object({ exerciseName: z.string() }))
    .query(({ ctx, input }) => db.getEquipmentPresets(ctx.user.id, input.exerciseName)),
  upsert: protectedProcedure
    .input(z.object({ exerciseName: z.string(), presetName: z.string(), lastSettings: z.string().nullable().optional() }))
    .mutation(({ ctx, input }) => db.upsertEquipmentPreset(ctx.user.id, input.exerciseName, input.presetName, input.lastSettings)),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => db.deleteEquipmentPreset(ctx.user.id, input.id)),
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
