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
      days: z.number().int().min(7).max(90).default(28),
    }))
    .query(async ({ input }) => {
      const now = new Date();
      const curFrom = new Date(now.getTime() - input.days * 86400000);
      const prevFrom = new Date(curFrom.getTime() - input.days * 86400000);
      const curLogs = await getMealLogsForUser(input.userId, curFrom, now);
      const prevLogs = await getMealLogsForUser(input.userId, prevFrom, curFrom);
      // All-time logs for personal baseline
      const allTimeLogs = await getMealLogsForUser(input.userId);
      const curMeals = curLogs.filter(l => l.mealType === 'meal');
      const prevMeals = prevLogs.filter(l => l.mealType === 'meal');
      const allTimeMeals = allTimeLogs.filter(l => l.mealType === 'meal');
      // Top stats
      const totalMeals = curMeals.length;
      const avgHunger = avg(curMeals.map(m => m.hungerRating));
      const avgFullness = avg(curMeals.map(m => m.fullnessRating));
      const prevAvgHunger = avg(prevMeals.map(m => m.hungerRating));
      const prevAvgFullness = avg(prevMeals.map(m => m.fullnessRating));
      // Ideal zone — current period
      const mealsWithBoth = curMeals.filter(m => m.hungerRating != null && m.fullnessRating != null);
      const idealCount = mealsWithBoth.filter(m =>
        m.hungerRating! >= 3 && m.hungerRating! <= 4 &&
        m.fullnessRating! >= 6 && m.fullnessRating! <= 7
      ).length;
      const idealZonePct = mealsWithBoth.length > 0
        ? Math.round(idealCount / mealsWithBoth.length * 100) : null;
      // Ideal zone — previous period
      const prevMealsWithBoth = prevMeals.filter(m => m.hungerRating != null && m.fullnessRating != null);
      const prevIdealCount = prevMealsWithBoth.filter(m =>
        m.hungerRating! >= 3 && m.hungerRating! <= 4 &&
        m.fullnessRating! >= 6 && m.fullnessRating! <= 7
      ).length;
      const prevIdealZonePct = prevMealsWithBoth.length > 0
        ? Math.round(prevIdealCount / prevMealsWithBoth.length * 100) : null;
      // Hunger in-zone % (hunger 3-4, regardless of fullness)
      const mealsWithHunger = curMeals.filter(m => m.hungerRating != null);
      const hungerInZonePct = mealsWithHunger.length > 0
        ? Math.round(mealsWithHunger.filter(m => m.hungerRating! >= 3 && m.hungerRating! <= 4).length / mealsWithHunger.length * 100)
        : null;
      // Fullness in-zone % (fullness 6-7, regardless of hunger)
      const mealsWithFullness = curMeals.filter(m => m.fullnessRating != null);
      const fullnessInZonePct = mealsWithFullness.length > 0
        ? Math.round(mealsWithFullness.filter(m => m.fullnessRating! >= 6 && m.fullnessRating! <= 7).length / mealsWithFullness.length * 100)
        : null;
      // All-time ideal zone % (personal baseline) — only meaningful if >28 days of history
      const allTimeMealsWithBoth = allTimeMeals.filter(m => m.hungerRating != null && m.fullnessRating != null);
      const allTimeIdealCount = allTimeMealsWithBoth.filter(m =>
        m.hungerRating! >= 3 && m.hungerRating! <= 4 &&
        m.fullnessRating! >= 6 && m.fullnessRating! <= 7
      ).length;
      // Only expose baseline if client has data spanning more than 28 days
      const allTimeSpanDays = allTimeMeals.length >= 2
        ? (allTimeMeals[allTimeMeals.length - 1].loggedAt.getTime() - allTimeMeals[0].loggedAt.getTime()) / 86400000
        : 0;
      const allTimeIdealZonePct = allTimeMealsWithBoth.length > 0 && allTimeSpanDays > 28
        ? Math.round(allTimeIdealCount / allTimeMealsWithBoth.length * 100)
        : null;
      // Per-week ideal zone breakdown for sparkline
      // Build 4 complete weeks + partial current week (oldest first)
      const weeklyIdealZone: { weekStart: string; pct: number | null; meals: number }[] = [];
      const numWeeks = input.days === 7 ? 1 : 4;
      for (let w = numWeeks - 1; w >= 0; w--) {
        const wEnd = new Date(now.getTime() - w * 7 * 86400000);
        wEnd.setHours(23, 59, 59, 999);
        const wStart = new Date(wEnd.getTime() - 6 * 86400000);
        wStart.setHours(0, 0, 0, 0);
        // Only include weeks within the current period
        if (wStart < curFrom) wStart.setTime(curFrom.getTime());
        const wMeals = curMeals.filter(m => m.loggedAt >= wStart && m.loggedAt <= wEnd);
        const wWithBoth = wMeals.filter(m => m.hungerRating != null && m.fullnessRating != null);
        const wIdeal = wWithBoth.filter(m =>
          m.hungerRating! >= 3 && m.hungerRating! <= 4 &&
          m.fullnessRating! >= 6 && m.fullnessRating! <= 7
        ).length;
        const pct = wWithBoth.length > 0 ? Math.round(wIdeal / wWithBoth.length * 100) : null;
        const ws = `${wStart.getFullYear()}-${String(wStart.getMonth()+1).padStart(2,'0')}-${String(wStart.getDate()).padStart(2,'0')}`;
        weeklyIdealZone.push({ weekStart: ws, pct, meals: wWithBoth.length });
      }
      // Scatter data
      const scatter = curMeals
        .filter(m => m.hungerRating != null && m.fullnessRating != null)
        .map(m => ({ h: m.hungerRating!, f: m.fullnessRating! }));
      // Treats: daily bars for 7d, weekly bars for 30d
      const treatsByWeek: { weekStart: string; small: number; medium: number; large: number; total: number }[] = [];
      if (input.days === 7) {
        // 7 daily bars, oldest first
        for (let d = 6; d >= 0; d--) {
          const dayStart = new Date(now);
          dayStart.setDate(dayStart.getDate() - d);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart);
          dayEnd.setHours(23, 59, 59, 999);
          const dTreats = curLogs.filter(l =>
            l.mealType === 'treat' && l.loggedAt >= dayStart && l.loggedAt <= dayEnd
          );
          const ds = `${dayStart.getFullYear()}-${String(dayStart.getMonth()+1).padStart(2,'0')}-${String(dayStart.getDate()).padStart(2,'0')}`;
          treatsByWeek.push({
            weekStart: ds,
            small: dTreats.filter(t => t.portionSize === 'small').length,
            medium: dTreats.filter(t => t.portionSize === 'medium').length,
            large: dTreats.filter(t => t.portionSize === 'large').length,
            total: dTreats.length,
          });
        }
      } else {
        // 5 weekly bars ending today, oldest first
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
      }
      // Meal timing slots — largest-gap splitting
      const mealOnly = curLogs.filter(l => l.mealType === 'meal');
      const allMealMins = mealOnly
        .map(m => m.loggedAt.getHours() * 60 + m.loggedAt.getMinutes())
        .filter(t => t >= 240) // exclude midnight-4am artefacts
        .sort((a, b) => a - b);

      // Determine how many slots to create: use mode of meals-per-day
      const mealsByDay: Record<string, number> = {};
      for (const m of mealOnly) {
        const d = m.loggedAt;
        const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        mealsByDay[k] = (mealsByDay[k] ?? 0) + 1;
      }
      const dayCounts = Object.values(mealsByDay);
      const countFreq: Record<number, number> = {};
      for (const c of dayCounts) countFreq[c] = (countFreq[c] ?? 0) + 1;
      const numSlots = dayCounts.length === 0 ? 0 :
        Number(Object.entries(countFreq).sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))[0][0]);

      // Split allMealMins into numSlots groups by finding the (numSlots-1) largest gaps
      const slots: { label: string; anchor: string; anchorMins: number; driftMin: number }[] = [];
      if (numSlots > 0 && allMealMins.length >= numSlots) {
        // Compute gaps between consecutive sorted times
        const gaps: { idx: number; gap: number }[] = [];
        for (let i = 1; i < allMealMins.length; i++) {
          gaps.push({ idx: i, gap: allMealMins[i] - allMealMins[i - 1] });
        }
        // Pick the (numSlots-1) largest gaps as split points
        const splitIdxs = gaps
          .sort((a, b) => b.gap - a.gap)
          .slice(0, numSlots - 1)
          .map(g => g.idx)
          .sort((a, b) => a - b);
        // Build clusters from split points
        const clusters: number[][] = [];
        let start = 0;
        for (const si of splitIdxs) {
          clusters.push(allMealMins.slice(start, si));
          start = si;
        }
        clusters.push(allMealMins.slice(start));
        // Build slots from clusters
        clusters.forEach((cluster, i) => {
          if (cluster.length === 0) return;
          const sorted = cluster.slice().sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          const anchorMins = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
          const drift = cluster.reduce((s, t) => s + Math.abs(t - anchorMins), 0) / cluster.length;
          const h = Math.floor(anchorMins / 60) % 24;
          const m = Math.round(anchorMins % 60);
          const ampm = h >= 12 ? 'pm' : 'am';
          const h12 = h % 12 === 0 ? 12 : h % 12;
          slots.push({ label: `Meal ${i + 1}`, anchor: `${h12}:${String(m).padStart(2, '0')} ${ampm}`, anchorMins, driftMin: Math.round(drift) });
        });
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
        prevIdealZonePct,
        hungerInZonePct,
        fullnessInZonePct,
        allTimeIdealZonePct,
        weeklyIdealZone,
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
