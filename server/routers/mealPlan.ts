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
    .mutation(({ ctx, input }) =>
      db.upsertMealPlan({ coachId: ctx.user.id, ...input })
    ),
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
