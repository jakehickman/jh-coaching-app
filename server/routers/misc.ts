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
  getServings: protectedProcedure
    .input(z.object({ foodId: z.number() }))
    .query(({ input }) => db.getServingsForFood(input.foodId)),
  getServingsForFoods: protectedProcedure
    .input(z.object({ foodIds: z.array(z.number()) }))
    .query(({ input }) => db.getServingsForFoods(input.foodIds)),
  upsertServing: adminProcedure
    .input(z.object({
      id: z.number().optional(),
      foodId: z.number(),
      label: z.string(),
      grams: z.number(),
      sortOrder: z.number().optional(),
    }))
    .mutation(({ input }) => db.upsertFoodServing(input)),
  deleteServing: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteFoodServing(input.id)),
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

export const changeLogRouter = router({
  getUnified: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const [training, nutrition, cardio] = await Promise.all([
        db.getProgramChangeLogs(input.userId),
        db.getMealPlanHistory(input.userId),
        db.getCardioChangeLogs(input.userId),
      ]);

      const entries: Array<{
        id: string;
        type: "training" | "nutrition" | "cardio";
        changedAt: Date;
        note: string | null;
        changes: unknown;
      }> = [
        ...training.map((e) => ({
          id: `training-${e.id}`,
          type: "training" as const,
          changedAt: e.changedAt,
          note: e.note ?? null,
          changes: e.changes,
        })),
        ...nutrition.map((e) => ({
          id: `nutrition-${e.id}`,
          type: "nutrition" as const,
          changedAt: e.changedAt,
          note: e.note ?? null,
          changes: {
            trainingCalories: e.trainingCalories,
            trainingProtein: e.trainingProtein,
            trainingCarbs: e.trainingCarbs,
            trainingFat: e.trainingFat,
            restCalories: e.restCalories,
            restProtein: e.restProtein,
            restCarbs: e.restCarbs,
            restFat: e.restFat,
          },
        })),
        ...cardio.map((e) => ({
          id: `cardio-${e.id}`,
          type: "cardio" as const,
          changedAt: e.changedAt,
          note: e.note ?? null,
          changes: e.changes,
        })),
      ];

      // Sort newest first
      entries.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
      return entries;
    }),
});

export const clientConfigRouter = router({
  update: adminProcedure
    .input(z.object({
      userId: z.number(),
      stepGoal: z.number().int().min(0).nullable().optional(),
      lissSessionsPerWeek: z.number().int().min(0).nullable().optional(),
      lissMinutesPerSession: z.number().int().min(0).nullable().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { userId, ...data } = input;
      return db.updateClientProfileExtended(userId, data, ctx.user.id);
    }),
  getChangeLogs: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => db.getCardioChangeLogs(input.userId)),
  updateChangeLogNote: adminProcedure
    .input(z.object({ id: z.number(), note: z.string().nullable() }))
    .mutation(({ input }) => db.updateCardioChangeLogNote(input.id, input.note)),
  deleteChangeLogEntry: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteCardioChangeLog(input.id)),
});
