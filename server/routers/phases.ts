import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { clientPhases, dailyLogs } from "../../drizzle/schema";
import { eq, desc, asc, or, and } from "drizzle-orm";

const PHASE_LABELS = ["Gaining", "Mini Cut", "Fat Loss", "Contest Prep", "Maintenance"] as const;

export const phasesRouter = router({
  // List phases for the currently authenticated client (self-service)
  listMine: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await db
        .select()
        .from(clientPhases)
        .where(eq(clientPhases.clientId, ctx.user.id))
        .orderBy(asc(clientPhases.startDate));
      return rows.map((r) => ({
        ...r,
        startDate: r.startDate instanceof Date ? r.startDate.toISOString().slice(0, 10) : String(r.startDate),
        endDate: r.endDate == null ? null : r.endDate instanceof Date ? r.endDate.toISOString().slice(0, 10) : String(r.endDate),
      }));
    }),

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
       .orderBy(asc(clientPhases.startDate));
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
        targetRate: z.string().nullable().optional(),
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
        targetRate: input.targetRate ?? null,
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
        targetRate: z.string().nullable().optional(),
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
      if (fields.targetRate !== undefined) updateFields.targetRate = fields.targetRate;
      await db.update(clientPhases).set(updateFields as any).where(eq(clientPhases.id, id));
      return { success: true };
    }),

  // Get the weight logged on or within ±1 day of a given date for a client
  weightForDate: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive(), date: z.string() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Build ±1 day date strings
      const d = new Date(input.date + "T00:00:00Z");
      const prev = new Date(d.getTime() - 86400000).toISOString().slice(0, 10);
      const next = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);

      const rows = await db
        .select({ logDate: dailyLogs.logDate, weight: dailyLogs.weight })
        .from(dailyLogs)
        .where(
          and(
            eq(dailyLogs.userId, input.clientId),
            or(
              eq(dailyLogs.logDate, input.date as any),
              eq(dailyLogs.logDate, prev as any),
              eq(dailyLogs.logDate, next as any),
            )
          )
        );

      // Pick the closest row with a weight value
      const targetMs = d.getTime();
      let best: { weight: number } | null = null;
      let bestDiff = Infinity;
      for (const row of rows) {
        if (row.weight == null) continue;
        const rowDate = row.logDate instanceof Date ? row.logDate.toISOString().slice(0, 10) : String(row.logDate);
        const diff = Math.abs(new Date(rowDate + "T00:00:00Z").getTime() - targetMs);
        if (diff < bestDiff) { bestDiff = diff; best = { weight: row.weight }; }
      }

      return best ? { weight: parseFloat(best.weight.toFixed(1)) } : { weight: null };
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
