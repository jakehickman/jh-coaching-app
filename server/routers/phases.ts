import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { clientPhases } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

const PHASE_LABELS = ["Gaining", "Mini Cut", "General Fat Loss", "Contest Prep"] as const;

export const phasesRouter = router({
  // List all phases for a client (newest first)
  list: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await db
        .select()
        .from(clientPhases)
        .where(eq(clientPhases.clientId, input.clientId))
        .orderBy(desc(clientPhases.startDate));
      // Drizzle returns date columns as Date objects from MySQL — serialize to YYYY-MM-DD strings
      return rows.map((r) => ({
        ...r,
        startDate: r.startDate instanceof Date
          ? r.startDate.toISOString().slice(0, 10)
          : String(r.startDate),
        endDate: r.endDate == null ? null
          : r.endDate instanceof Date
          ? r.endDate.toISOString().slice(0, 10)
          : String(r.endDate),
      }));
    }),

  // Create a new phase
  create: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        label: z.enum(PHASE_LABELS),
        startDate: z.string(), // YYYY-MM-DD
        endDate: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        startWeight: z.number().nullable().optional(),
        targetWeight: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const result = await db.insert(clientPhases).values({
        clientId: input.clientId,
        label: input.label,
        startDate: input.startDate as any,
        endDate: (input.endDate ?? null) as any,
        notes: input.notes ?? null,
        startWeight: input.startWeight ?? null,
        targetWeight: input.targetWeight ?? null,
      });
      return { id: Number((result as any).insertId) };
    }),

  // Update an existing phase
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        label: z.enum(PHASE_LABELS).optional(),
        startDate: z.string().optional(),
        endDate: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        startWeight: z.number().nullable().optional(),
        targetWeight: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { id, ...fields } = input;
      const updateFields: Record<string, unknown> = {};
      if (fields.label !== undefined) updateFields.label = fields.label;
      if (fields.startDate !== undefined) updateFields.startDate = fields.startDate as any;
      if (fields.endDate !== undefined) updateFields.endDate = fields.endDate as any;
      if (fields.notes !== undefined) updateFields.notes = fields.notes;
      if (fields.startWeight !== undefined) updateFields.startWeight = fields.startWeight;
      if (fields.targetWeight !== undefined) updateFields.targetWeight = fields.targetWeight;
      await db.update(clientPhases).set(updateFields as any).where(eq(clientPhases.id, id));
      return { success: true };
    }),

  // Delete a phase
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(clientPhases).where(eq(clientPhases.id, input.id));
      return { success: true };
    }),
});
