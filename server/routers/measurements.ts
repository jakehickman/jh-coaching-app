import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { adminProcedure } from "./shared";
import * as db from "../db";
import { getDb } from "../db";
import { measurements } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const measurementsRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.getMeasurements(ctx.user.id)),
  listForClient: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => db.getMeasurements(input.userId)),
  add: protectedProcedure
    .input(
      z.object({
        measureDate: z.string(),
        waist: z.number().optional(),
        hips: z.number().optional(),
        umbilical1: z.number().optional(), umbilical2: z.number().optional(), umbilical3: z.number().optional(), umbilical4: z.number().optional(), umbilical5: z.number().optional(),
        suprailiac1: z.number().optional(), suprailiac2: z.number().optional(), suprailiac3: z.number().optional(), suprailiac4: z.number().optional(), suprailiac5: z.number().optional(),
        calf1: z.number().optional(), calf2: z.number().optional(), calf3: z.number().optional(), calf4: z.number().optional(), calf5: z.number().optional(),
        thigh1: z.number().optional(), thigh2: z.number().optional(), thigh3: z.number().optional(), thigh4: z.number().optional(), thigh5: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      db.addMeasurement({ userId: ctx.user.id, ...input })
    ),
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        measureDate: z.string().optional(),
        waist: z.number().nullable().optional(),
        hips: z.number().nullable().optional(),
        umbilical1: z.number().nullable().optional(), umbilical2: z.number().nullable().optional(), umbilical3: z.number().nullable().optional(), umbilical4: z.number().nullable().optional(), umbilical5: z.number().nullable().optional(),
        suprailiac1: z.number().nullable().optional(), suprailiac2: z.number().nullable().optional(), suprailiac3: z.number().nullable().optional(), suprailiac4: z.number().nullable().optional(), suprailiac5: z.number().nullable().optional(),
        calf1: z.number().nullable().optional(), calf2: z.number().nullable().optional(), calf3: z.number().nullable().optional(), calf4: z.number().nullable().optional(), calf5: z.number().nullable().optional(),
        thigh1: z.number().nullable().optional(), thigh2: z.number().nullable().optional(), thigh3: z.number().nullable().optional(), thigh4: z.number().nullable().optional(), thigh5: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updateMeasurement(id, ctx.user.id, data);
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => db.deleteMeasurement(input.id, ctx.user.id)),

  // Coach-side procedures (no userId check — admin can manage any client's data)
  updateForClient: adminProcedure
    .input(
      z.object({
        id: z.number(),
        userId: z.number(),
        measureDate: z.string().optional(),
        waist: z.number().nullable().optional(),
        hips: z.number().nullable().optional(),
        umbilical1: z.number().nullable().optional(), umbilical2: z.number().nullable().optional(), umbilical3: z.number().nullable().optional(), umbilical4: z.number().nullable().optional(), umbilical5: z.number().nullable().optional(),
        suprailiac1: z.number().nullable().optional(), suprailiac2: z.number().nullable().optional(), suprailiac3: z.number().nullable().optional(), suprailiac4: z.number().nullable().optional(), suprailiac5: z.number().nullable().optional(),
        calf1: z.number().nullable().optional(), calf2: z.number().nullable().optional(), calf3: z.number().nullable().optional(), calf4: z.number().nullable().optional(), calf5: z.number().nullable().optional(),
        thigh1: z.number().nullable().optional(), thigh2: z.number().nullable().optional(), thigh3: z.number().nullable().optional(), thigh4: z.number().nullable().optional(), thigh5: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, userId, ...data } = input;
      const dbConn = await getDb();
      if (!dbConn) return;
      await dbConn.update(measurements).set(data as any).where(eq(measurements.id, id));
    }),

  deleteForClient: adminProcedure
    .input(z.object({ id: z.number(), userId: z.number() }))
    .mutation(async ({ input }) => {
      const dbConn = await getDb();
      if (!dbConn) return;
      await dbConn.delete(measurements).where(eq(measurements.id, input.id));
    }),
});
