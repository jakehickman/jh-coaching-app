import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { adminProcedure } from "./shared";
import * as db from "../db";

export const mealPlanRouter = router({
  get: protectedProcedure
    .input(z.object({ dayType: z.enum(["training", "rest"]) }))
    .query(async ({ ctx, input }) => (await db.getMealPlan(ctx.user.id, input.dayType)) ?? null),
  getForClient: adminProcedure
    .input(z.object({ userId: z.number(), dayType: z.enum(["training", "rest"]) }))
    .query(async ({ input }) => (await db.getMealPlan(input.userId, input.dayType)) ?? null),
  upsert: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        dayType: z.enum(["training", "rest"]),
        meals: z.any().optional(),
        totalCalories: z.number().optional(),
        totalProtein: z.number().optional(),
        totalCarbs: z.number().optional(),
        totalFat: z.number().optional(),
        treatAllowanceKcal: z.number().int().min(0).nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.upsertMealPlan({ coachId: ctx.user.id, ...input });
      // Snapshot both plans together for the change history
      const [training, rest] = await Promise.all([
        db.getMealPlan(input.userId, "training"),
        db.getMealPlan(input.userId, "rest"),
      ]);
      await db.insertMealPlanHistorySnapshot({
        userId: input.userId,
        coachId: ctx.user.id,
        trainingCalories: training?.totalCalories ?? null,
        trainingProtein: training?.totalProtein ?? null,
        trainingCarbs: training?.totalCarbs ?? null,
        trainingFat: training?.totalFat ?? null,
        restCalories: rest?.totalCalories ?? null,
        restProtein: rest?.totalProtein ?? null,
        restCarbs: rest?.totalCarbs ?? null,
        restFat: rest?.totalFat ?? null,
      });
    }),
  getHistory: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => db.getMealPlanHistory(input.userId)),
  updateHistoryNote: adminProcedure
    .input(z.object({ id: z.number(), note: z.string().nullable() }))
    .mutation(({ input }) => db.updateMealPlanHistoryNote(input.id, input.note)),
  deleteHistoryEntry: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteMealPlanHistoryEntry(input.id)),
});

const macroMealSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  time: z.string().optional(),
  caloriesMin: z.number().nullable().optional(),
  caloriesMax: z.number().nullable().optional(),
  proteinMin: z.number().nullable().optional(),
  proteinMax: z.number().nullable().optional(),
  carbsMin: z.number().nullable().optional(),
  carbsMax: z.number().nullable().optional(),
  fatMin: z.number().nullable().optional(),
  fatMax: z.number().nullable().optional(),
});

export const macroTargetRouter = router({
  // Client reads their own macro targets
  get: protectedProcedure
    .input(z.object({ dayType: z.enum(["training", "rest"]) }))
    .query(({ ctx, input }) => db.getMacroTarget(ctx.user.id, input.dayType)),
  // Coach reads a client's macro targets
  getForClient: adminProcedure
    .input(z.object({ userId: z.number(), dayType: z.enum(["training", "rest"]) }))
    .query(({ input }) => db.getMacroTarget(input.userId, input.dayType)),
  // Coach saves macro targets for a client
  upsert: adminProcedure
    .input(z.object({
      userId: z.number(),
      dayType: z.enum(["training", "rest"]),
      meals: z.array(macroMealSchema).optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(({ ctx, input }) => db.upsertMacroTarget({ coachId: ctx.user.id, ...input })),
  // Coach reads/sets the nutrition mode for a client
  getMode: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => db.getNutritionMode(input.userId)),
  setMode: adminProcedure
    .input(z.object({ userId: z.number(), mode: z.enum(["meal_plan", "macros"]) }))
    .mutation(({ input }) => db.setNutritionMode(input.userId, input.mode)),
  // Client reads their own nutrition mode
  getMyMode: protectedProcedure
    .query(({ ctx }) => db.getNutritionMode(ctx.user.id)),
});

export const shoppingRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.getShoppingItems(ctx.user.id)),
  listForClient: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => db.getShoppingItems(input.userId)),
  toggle: protectedProcedure
    .input(z.object({ id: z.number(), checked: z.boolean() }))
    .mutation(({ input }) => db.toggleShoppingItem(input.id, input.checked)),
  add: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        category: z.string().optional(),
        itemName: z.string(),
        quantity: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(({ input }) => db.addShoppingItem(input)),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteShoppingItem(input.id)),
});
