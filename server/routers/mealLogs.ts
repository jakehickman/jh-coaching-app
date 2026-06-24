import z from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { adminProcedure } from "./shared";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { mealLogs } from "../../drizzle/schema";
import { eq, and, gte, lte, desc, asc } from "drizzle-orm";
import { storagePut } from "../storage";

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

function avg(vals: (number | null | undefined)[]): number | null {
  const valid = vals.filter((v): v is number => v != null && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getMealLogsForUser(userId: number, from?: Date, to?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(mealLogs.userId, userId)];
  if (from) conditions.push(gte(mealLogs.loggedAt, from));
  if (to) conditions.push(lte(mealLogs.loggedAt, to));
  return db
    .select()
    .from(mealLogs)
    .where(and(...conditions))
    .orderBy(asc(mealLogs.loggedAt));
}

function computeInsights(logs: typeof mealLogs.$inferSelect[], periodDays: number) {
  const meals = logs.filter((l) => l.mealType === "meal");
  const treats = logs.filter((l) => l.mealType === "treat");

  const totalMeals = meals.length;
  const totalTreats = treats.length;

  const avgHunger = avg(meals.map((m) => m.hungerRating));
  const avgFullness = avg(meals.map((m) => m.fullnessRating));

  // Ideal zone: hunger 3-4 AND fullness 6-7
  const mealsWithBoth = meals.filter(
    (m) => m.hungerRating != null && m.fullnessRating != null
  );
  const idealZoneCount = mealsWithBoth.filter(
    (m) => (m.hungerRating! >= 3 && m.hungerRating! <= 4) &&
            (m.fullnessRating! >= 6 && m.fullnessRating! <= 7)
  ).length;
  const idealZonePct = mealsWithBoth.length > 0
    ? Math.round((idealZoneCount / mealsWithBoth.length) * 100)
    : null;

  // Hunger distribution (1-10)
  const hungerDist: Record<number, number> = {};
  for (let i = 1; i <= 10; i++) hungerDist[i] = 0;
  meals.forEach((m) => { if (m.hungerRating != null) hungerDist[m.hungerRating]++; });

  // Fullness distribution (1-10)
  const fullnessDist: Record<number, number> = {};
  for (let i = 1; i <= 10; i++) fullnessDist[i] = 0;
  meals.forEach((m) => { if (m.fullnessRating != null) fullnessDist[m.fullnessRating]++; });

  // Meal timing
  const dayMap: Record<string, Date[]> = {};
  logs.forEach((l) => {
    const d = l.loggedAt.toISOString().slice(0, 10);
    if (!dayMap[d]) dayMap[d] = [];
    dayMap[d].push(l.loggedAt);
  });

  const firstMealTimes: number[] = []; // minutes since midnight
  const lastMealTimes: number[] = [];
  const gapsBetweenMeals: number[] = [];

  Object.values(dayMap).forEach((times) => {
    const sorted = times.map((t) => t.getHours() * 60 + t.getMinutes()).sort((a, b) => a - b);
    if (sorted.length > 0) {
      firstMealTimes.push(sorted[0]);
      lastMealTimes.push(sorted[sorted.length - 1]);
    }
    for (let i = 1; i < sorted.length; i++) {
      gapsBetweenMeals.push(sorted[i] - sorted[i - 1]);
    }
  });

  const minutesToTime = (mins: number | null) => {
    if (mins == null) return null;
    const h = Math.floor(mins / 60) % 24;
    const m = Math.round(mins % 60);
    const ampm = h >= 12 ? "pm" : "am";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const avgFirstMeal = minutesToTime(avg(firstMealTimes));
  const avgLastMeal = minutesToTime(avg(lastMealTimes));
  const avgGapMins = avg(gapsBetweenMeals);
  const avgGapHours = avgGapMins != null ? Math.round(avgGapMins / 6) / 10 : null;

  // Off-plan count
  const offPlanCount = logs.filter((l) => l.isOffPlan).length;

  return {
    periodDays,
    totalMeals,
    totalTreats,
    offPlanCount,
    avgHunger: avgHunger != null ? Math.round(avgHunger * 10) / 10 : null,
    avgFullness: avgFullness != null ? Math.round(avgFullness * 10) / 10 : null,
    idealZoneCount,
    idealZonePct,
    mealsWithBothRatings: mealsWithBoth.length,
    hungerDist,
    fullnessDist,
    avgFirstMeal,
    avgLastMeal,
    avgGapHours,
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const mealLogsRouter = router({
  // ── Client: log a new meal ────────────────────────────────────────────────
  log: protectedProcedure
    .input(
      z.object({
        loggedAt: z.number(), // Unix ms timestamp
        mealType: z.enum(["meal", "treat"]),
        name: z.string().max(256).optional(),
        // Photo: base64 encoded image (without data: prefix)
        imageBase64: z.string().optional(),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
        portionSize: z.enum(["small", "medium", "large"]).optional(),
        hungerRating: z.number().int().min(1).max(10).optional(),
        isOffPlan: z.boolean().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let photoUrl: string | null = null;
      let photoKey: string | null = null;

      if (input.imageBase64 && input.mimeType) {
        const buffer = Buffer.from(input.imageBase64, "base64");
        const ext = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
        const key = `meal-photos/${ctx.user.id}/${Date.now()}-${randomSuffix()}.${ext}`;
        const result = await storagePut(key, buffer, input.mimeType);
        photoUrl = result.url;
        photoKey = key;
      }

      const [result] = await db.insert(mealLogs).values({
        userId: ctx.user.id,
        loggedAt: new Date(input.loggedAt),
        mealType: input.mealType,
        name: input.name ?? null,
        photoUrl,
        photoKey,
        portionSize: input.portionSize ?? null,
        hungerRating: input.hungerRating ?? null,
        fullnessRating: null,
        isOffPlan: input.isOffPlan ?? false,
        notes: input.notes ?? null,
      });

      return { id: (result as any).insertId as number };
    }),

  // ── Client: rate fullness after eating ───────────────────────────────────
  rateFullness: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      fullnessRating: z.number().int().min(1).max(10),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const updateData: Record<string, unknown> = { fullnessRating: input.fullnessRating };
      if (input.notes !== undefined) updateData.notes = input.notes;
      await db
        .update(mealLogs)
        .set(updateData as any)
        .where(and(eq(mealLogs.id, input.id), eq(mealLogs.userId, ctx.user.id)));
      return { ok: true };
    }),

  // ── Client: edit a meal ───────────────────────────────────────────────────
  edit: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().max(256).optional(),
        portionSize: z.enum(["small", "medium", "large"]).nullable().optional(),
        hungerRating: z.number().int().min(1).max(10).nullable().optional(),
        fullnessRating: z.number().int().min(1).max(10).nullable().optional(),
        isOffPlan: z.boolean().optional(),
        notes: z.string().nullable().optional(),
        // Optional new photo
        imageBase64: z.string().optional(),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, imageBase64, mimeType, ...fields } = input;

      const updateData: Record<string, unknown> = {};
      if (fields.name !== undefined) updateData.name = fields.name;
      if (fields.portionSize !== undefined) updateData.portionSize = fields.portionSize;
      if (fields.hungerRating !== undefined) updateData.hungerRating = fields.hungerRating;
      if (fields.fullnessRating !== undefined) updateData.fullnessRating = fields.fullnessRating;
      if (fields.isOffPlan !== undefined) updateData.isOffPlan = fields.isOffPlan;
      if (fields.notes !== undefined) updateData.notes = fields.notes;

      if (imageBase64 && mimeType) {
        const buffer = Buffer.from(imageBase64, "base64");
        const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
        const key = `meal-photos/${ctx.user.id}/${Date.now()}-${randomSuffix()}.${ext}`;
        const result = await storagePut(key, buffer, mimeType);
        updateData.photoUrl = result.url;
        updateData.photoKey = key;
      }

      if (Object.keys(updateData).length > 0) {
        await db
          .update(mealLogs)
          .set(updateData as any)
          .where(and(eq(mealLogs.id, id), eq(mealLogs.userId, ctx.user.id)));
      }
      return { ok: true };
    }),

  // ── Client: delete a meal ─────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .delete(mealLogs)
        .where(and(eq(mealLogs.id, input.id), eq(mealLogs.userId, ctx.user.id)));
      return { ok: true };
    }),

  // ── Client: list meals for a specific day ─────────────────────────────────
  listByDay: protectedProcedure
    .input(z.object({ date: z.string() })) // YYYY-MM-DD in local time
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      // Build UTC range covering the full local day
      // We use a generous ±1 day window and filter client-side by local date
      // to avoid timezone edge cases on the server
      const base = new Date(input.date + "T00:00:00.000Z");
      const from = new Date(base.getTime() - 24 * 60 * 60 * 1000);
      const to = new Date(base.getTime() + 2 * 24 * 60 * 60 * 1000);
      return getMealLogsForUser(ctx.user.id, from, to);
    }),

  // ── Client: list all meals (for history navigation) ───────────────────────
  listAll: protectedProcedure.query(async ({ ctx }) => {
    return getMealLogsForUser(ctx.user.id);
  }),

  // ── Client: insights for self ─────────────────────────────────────────────
  insights: protectedProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      const to = new Date();
      const from = new Date(to.getTime() - input.days * 24 * 60 * 60 * 1000);
      const logs = await getMealLogsForUser(ctx.user.id, from, to);
      return computeInsights(logs, input.days);
    }),

  // ── Client: list dates that have meals (for calendar dots) ─────────────
  listDatesWithMeals: protectedProcedure
    .input(z.object({ month: z.string() })) // "YYYY-MM"
    .query(async ({ ctx, input }) => {
      const [year, mon] = input.month.split("-").map(Number);
      const from = new Date(year, mon - 1, 1);
      const to = new Date(year, mon, 0, 23, 59, 59, 999);
      const logs = await getMealLogsForUser(ctx.user.id, from, to);
      const dates = new Set<string>();
      for (const log of logs) {
        const d = new Date(log.loggedAt);
        dates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      }
      return Array.from(dates);
    }),

  // ── Coach: list all meals for a client ───────────────────────────────────
  listForClient: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ input }) => {
      return getMealLogsForUser(input.userId);
    }),

  // ── Coach: insights for a client ─────────────────────────────────────────
  insightsForClient: adminProcedure
    .input(z.object({ userId: z.number().int().positive(), days: z.number().int().min(1).max(365).default(30) }))
    .query(async ({ input }) => {
      const to = new Date();
      const from = new Date(to.getTime() - input.days * 24 * 60 * 60 * 1000);
      const logs = await getMealLogsForUser(input.userId, from, to);
      return computeInsights(logs, input.days);
    }),

  // ── Coach: calendar view — meals grouped by date for a given month ─────────
  calendarForClient: adminProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      year: z.number().int(),
      month: z.number().int().min(1).max(12),
    }))
    .query(async ({ input }) => {
      const from = new Date(input.year, input.month - 1, 1);
      const to = new Date(input.year, input.month, 0, 23, 59, 59, 999);
      const logs = await getMealLogsForUser(input.userId, from, to);
      const byDate: Record<string, { meals: any[]; hasOutOfRange: boolean; treatCount: number }> = {};
      for (const log of logs) {
        const d = log.loggedAt;
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (!byDate[key]) byDate[key] = { meals: [], hasOutOfRange: false, treatCount: 0 };
        byDate[key].meals.push(log);
        if (log.mealType === 'treat') byDate[key].treatCount++;
        if (log.mealType === 'meal') {
          const h = log.hungerRating; const f = log.fullnessRating;
          if ((h != null && (h < 3 || h > 4)) || (f != null && (f < 6 || f > 7))) {
            byDate[key].hasOutOfRange = true;
          }
        }
      }
      return byDate;
    }),

  // ── Coach: rich insights with scatter, treats-by-week, meal timing slots ──
  richInsightsForClient: adminProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      days: z.number().int().min(7).max(90).default(30),
    }))
    .query(async ({ input }) => {
      const now = new Date();
      const curFrom = new Date(now.getTime() - input.days * 86400000);
      const prevFrom = new Date(curFrom.getTime() - input.days * 86400000);
      const curLogs = await getMealLogsForUser(input.userId, curFrom, now);
      const prevLogs = await getMealLogsForUser(input.userId, prevFrom, curFrom);
      const curMeals = curLogs.filter(l => l.mealType === 'meal');
      const prevMeals = prevLogs.filter(l => l.mealType === 'meal');
      // Top stats
      const totalMeals = curMeals.length;
      const avgHunger = avg(curMeals.map(m => m.hungerRating));
      const avgFullness = avg(curMeals.map(m => m.fullnessRating));
      const prevAvgHunger = avg(prevMeals.map(m => m.hungerRating));
      const prevAvgFullness = avg(prevMeals.map(m => m.fullnessRating));
      // Ideal zone
      const mealsWithBoth = curMeals.filter(m => m.hungerRating != null && m.fullnessRating != null);
      const idealCount = mealsWithBoth.filter(m =>
        m.hungerRating! >= 3 && m.hungerRating! <= 4 &&
        m.fullnessRating! >= 6 && m.fullnessRating! <= 7
      ).length;
      const idealZonePct = mealsWithBoth.length > 0
        ? Math.round(idealCount / mealsWithBoth.length * 100) : null;
      // Scatter data
      const scatter = curMeals
        .filter(m => m.hungerRating != null && m.fullnessRating != null)
        .map(m => ({ h: m.hungerRating!, f: m.fullnessRating! }));
      // Treats by week (last 5 complete weeks ending today)
      const treatsByWeek: { weekStart: string; small: number; medium: number; large: number; total: number }[] = [];
      for (let w = 4; w >= 0; w--) {
        const wEnd = new Date(now);
        wEnd.setDate(wEnd.getDate() - w * 7);
        wEnd.setHours(23, 59, 59, 999);
        const wStart = new Date(wEnd);
        wStart.setDate(wStart.getDate() - 6);
        wStart.setHours(0, 0, 0, 0);
        const wTreats = curLogs.filter(l =>
          l.mealType === 'treat' && l.loggedAt >= wStart && l.loggedAt <= wEnd
        );
        const ws = `${wStart.getFullYear()}-${String(wStart.getMonth()+1).padStart(2,'0')}-${String(wStart.getDate()).padStart(2,'0')}`;
        treatsByWeek.push({
          weekStart: ws,
          small: wTreats.filter(t => t.portionSize === 'small').length,
          medium: wTreats.filter(t => t.portionSize === 'medium').length,
          large: wTreats.filter(t => t.portionSize === 'large').length,
          total: wTreats.length,
        });
      }
      // Meal timing slots
      const mealOnly = curLogs.filter(l => l.mealType === 'meal');
      const dayMap: Record<string, number[]> = {};
      for (const m of mealOnly) {
        const d = m.loggedAt;
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (!dayMap[key]) dayMap[key] = [];
        dayMap[key].push(d.getHours() * 60 + d.getMinutes());
      }
      const dayCounts = Object.values(dayMap).map(t => t.length);
      // Find mode
      const countFreq: Record<number, number> = {};
      dayCounts.forEach(c => { countFreq[c] = (countFreq[c] ?? 0) + 1; });
      const modeCount = dayCounts.length > 0
        ? parseInt(Object.entries(countFreq).sort((a,b) => b[1]-a[1])[0][0])
        : 0;
      // Slot anchors from days with exactly modeCount meals
      const modeDays = Object.values(dayMap)
        .filter(t => t.length === modeCount)
        .map(t => t.slice().sort((a,b) => a-b));
      const slots: { label: string; anchor: string; anchorMins: number; driftMin: number }[] = [];
      if (modeDays.length >= 3 && modeCount > 0) {
        for (let s = 0; s < modeCount; s++) {
          // Filter out midnight-4am artefacts (meals logged 0:00-3:59am)
          const slotTimes = modeDays.map(d => d[s]).filter(t => t >= 240);
          // Need at least half the mode-days to have a valid time for this slot
          if (slotTimes.length < Math.max(3, Math.floor(modeDays.length * 0.4))) continue;
          // Use median for robustness against outliers
          const sorted = slotTimes.slice().sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          const anchorMins = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
          const drift = avg(slotTimes.map(t => Math.abs(t - anchorMins)))!;
          const h = Math.floor(anchorMins / 60) % 24;
          const m = Math.round(anchorMins % 60);
          const ampm = h >= 12 ? 'pm' : 'am';
          const h12 = h % 12 === 0 ? 12 : h % 12;
          slots.push({ label: `Meal ${s+1}`, anchor: `${h12}:${String(m).padStart(2,'0')} ${ampm}`, anchorMins, driftMin: Math.round(drift) });
        }
      }
      // Consistency score
      let onTime = 0;
      const totalForConsistency = mealOnly.length;
      if (slots.length > 0) {
        for (const m of mealOnly) {
          const mins = m.loggedAt.getHours() * 60 + m.loggedAt.getMinutes();
          const nearest = Math.min(...slots.map(s => Math.abs(mins - s.anchorMins)));
          if (nearest <= 60) onTime++;
        }
      }
      const consistencyScore = totalForConsistency > 0
        ? Math.round(onTime / totalForConsistency * 100) : null;
      return {
        totalMeals,
        avgHunger: avgHunger != null ? Math.round(avgHunger * 10) / 10 : null,
        avgFullness: avgFullness != null ? Math.round(avgFullness * 10) / 10 : null,
        prevAvgHunger: prevAvgHunger != null ? Math.round(prevAvgHunger * 10) / 10 : null,
        prevAvgFullness: prevAvgFullness != null ? Math.round(prevAvgFullness * 10) / 10 : null,
        idealZonePct,
        idealCount,
        mealsWithBothRatings: mealsWithBoth.length,
        scatter,
        treatsByWeek,
        slots: slots.map(s => ({ label: s.label, anchor: s.anchor, driftMin: s.driftMin })),
        consistencyScore,
        totalForConsistency,
        hasTimingData: slots.length > 0,
      };
    }),

  // ── Coach: weekly nutrition summary (for check-in cards) ─────────────────
  weeklySummaryForClient: adminProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      weekStart: z.string(), // YYYY-MM-DD
      weekEnd: z.string(),   // YYYY-MM-DD
    }))
    .query(async ({ input }) => {
      const from = new Date(input.weekStart + "T00:00:00.000Z");
      const to = new Date(input.weekEnd + "T23:59:59.999Z");
      const logs = await getMealLogsForUser(input.userId, from, to);
      return computeInsights(logs, 7);
    }),
});
