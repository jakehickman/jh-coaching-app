import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { adminProcedure } from "./shared";
import * as db from "../db";

export const dailyLogRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(({ ctx, input }) => db.getDailyLogs(ctx.user.id, input.limit)),
  listForClient: adminProcedure
    .input(z.object({ userId: z.number(), limit: z.number().optional() }))
    .query(({ input }) => db.getDailyLogs(input.userId, input.limit)),
  upsert: protectedProcedure
    .input(
      z.object({
        logDate: z.string(),
        weight: z.number().optional(),
        sleepHours: z.number().optional(),
        caffeineServings: z.number().optional(),
        trainingCompleted: z.boolean().optional(),
        trainingType: z.string().optional(),
        stepsCount: z.number().optional(),
        sleepQuality: z.number().min(1).max(5).optional(),
        hungerLevel: z.number().min(1).max(5).optional(),
        offPlanMeals: z.number().int().min(0).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      db.upsertDailyLog({ userId: ctx.user.id, ...input })
    ),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => db.deleteDailyLog(input.id, ctx.user.id)),
});
