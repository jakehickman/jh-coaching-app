import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { adminProcedure } from "./shared";
import * as db from "../db";

export const timelineRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.getTimelineMilestones(ctx.user.id)),
  listForClient: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => db.getTimelineMilestones(input.userId)),
  toggle: protectedProcedure
    .input(z.object({ id: z.number(), completed: z.boolean() }))
    .mutation(({ input }) => db.toggleMilestone(input.id, input.completed)),
});

export const notesRouter = router({
  list: adminProcedure
    .input(z.object({ clientId: z.number() }))
    .query(({ input }) => db.getCoachingNotes(input.clientId)),
  add: adminProcedure
    .input(
      z.object({
        clientId: z.number(),
        noteDate: z.string(),
        content: z.string(),
        category: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      db.addCoachingNote({ coachId: ctx.user.id, ...input })
    ),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteCoachingNote(input.id)),
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        noteDate: z.string().optional(),
        content: z.string().optional(),
        category: z.string().optional(),
      })
    )
    .mutation(({ input }) => db.updateCoachingNote(input)),
});

export const nutritionFoodsRouter = router({
  list: protectedProcedure.query(() => db.listNutritionFoods()),
  upsert: adminProcedure
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string(),
        calories: z.number(),
        protein: z.number(),
        carbs: z.number(),
        fiber: z.number(),
        fat: z.number(),
        servingUnit: z.string().nullable().optional(),
        servingGrams: z.number().nullable().optional(),
      })
    )
    .mutation(({ input }) => db.upsertNutritionFood(input as any)),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteNutritionFood(input.id)),
});

export const onboardingRouter = router({
  submit: publicProcedure
    .input(
      z.object({
        fullName: z.string().min(1),
        email: z.string().email(),
        age: z.number().int().min(13).max(100).optional(),
        heightCm: z.number().positive().optional(),
        currentWeightKg: z.number().positive().optional(),
        goalWeightKg: z.number().positive().optional(),
        primaryGoal: z.string().optional(),
        trainingExperience: z.string().optional(),
        trainingFrequency: z.string().optional(),
        equipment: z.string().optional(),
        dietApproach: z.string().optional(),
        injuries: z.string().optional(),
        lifestyle: z.string().optional(),
        additionalInfo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id ?? null;
      return db.createOnboardingSubmission({ ...input, userId });
    }),
  list: adminProcedure.query(() => db.listOnboardingSubmissions()),
  markReviewed: adminProcedure
    .input(z.object({ id: z.number(), reviewed: z.boolean() }))
    .mutation(({ input }) => db.markOnboardingReviewed(input.id, input.reviewed)),
});

export const clientConfigRouter = router({
  update: adminProcedure
    .input(z.object({
      userId: z.number(),
      checkInDay: z.enum(["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]).nullable().optional(),
      stepGoal: z.number().int().min(0).nullable().optional(),
      treatAllowanceKcal: z.number().int().min(0).nullable().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { userId, ...data } = input;
      return db.updateClientProfileExtended(userId, data, ctx.user.id);
    }),
});
