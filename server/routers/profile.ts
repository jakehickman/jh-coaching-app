import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { adminProcedure } from "./shared";
import * as db from "../db";

export const profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) =>
    (await db.getClientProfile(ctx.user.id)) ?? null
  ),
  getById: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => (await db.getClientProfile(input.userId)) ?? null),
  upsert: protectedProcedure
    .input(
      z.object({
        displayName: z.string().optional(),
        startDate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      db.upsertClientProfile({ userId: ctx.user.id, ...input })
    ),
  upsertForClient: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        coachId: z.number().optional(),
        displayName: z.string().optional(),
        startDate: z.string().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(({ input }) => db.upsertClientProfile(input)),
});
