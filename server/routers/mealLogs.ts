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

  // Meal timing — use stored utcOffsetMins for local time if available
  const toLocalMinsFn = (l: typeof logs[0]) => {
    const utcMins = l.loggedAt.getUTCHours() * 60 + l.loggedAt.getUTCMinutes();
    const offset = (l as any).utcOffsetMins ?? 0;
    return ((utcMins + offset) % 1440 + 1440) % 1440;
  };
  const toLocalDayKey = (l: typeof logs[0]) => {
    const offset = (l as any).utcOffsetMins ?? 0;
    const localDate = new Date(l.loggedAt.getTime() + offset * 60 * 1000);
    return `${localDate.getUTCFullYear()}-${localDate.getUTCMonth()}-${localDate.getUTCDate()}`;
  };
  const dayMap: Record<string, number[]> = {};
  logs.forEach((l) => {
    const d = toLocalDayKey(l);
    if (!dayMap[d]) dayMap[d] = [];
    dayMap[d].push(toLocalMinsFn(l));
  });

  const firstMealTimes: number[] = []; // minutes since midnight
  const lastMealTimes: number[] = [];
  const gapsBetweenMeals: number[] = [];

  Object.values(dayMap).forEach((times) => {
    const sorted = [...times].sort((a, b) => a - b);
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
        // Photo: either pre-uploaded URL (fast path) or base64 for inline upload
        photoUrl: z.string().optional(),   // pre-uploaded S3 URL from uploadPhoto
        photoKey: z.string().optional(),   // pre-uploaded S3 key from uploadPhoto
        imageBase64: z.string().optional(), // fallback: inline base64
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
        portionSize: z.enum(["small", "medium", "large"]).optional(),
        hungerRating: z.number().int().min(1).max(10).optional(),
        isOffPlan: z.boolean().optional(),
        notes: z.string().optional(),
        utcOffsetMins: z.number().int().optional(), // client's UTC offset in minutes
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let photoUrl: string | null = input.photoUrl ?? null;
      let photoKey: string | null = input.photoKey ?? null;

      // Fallback: inline base64 upload (legacy path)
      if (!photoUrl && input.imageBase64 && input.mimeType) {
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
        utcOffsetMins: input.utcOffsetMins ?? null,
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
        // Optional new photo — either pre-uploaded URL (fast) or inline base64
        photoUrl: z.string().nullable().optional(), // null = explicitly remove photo
        photoKey: z.string().optional(),
        imageBase64: z.string().optional(),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, photoUrl: preUploadedUrl, photoKey: preUploadedKey, imageBase64, mimeType, ...fields } = input;

      const updateData: Record<string, unknown> = {};
      if (fields.name !== undefined) updateData.name = fields.name;
      if (fields.portionSize !== undefined) updateData.portionSize = fields.portionSize;
      if (fields.hungerRating !== undefined) updateData.hungerRating = fields.hungerRating;
      if (fields.fullnessRating !== undefined) updateData.fullnessRating = fields.fullnessRating;
      if (fields.isOffPlan !== undefined) updateData.isOffPlan = fields.isOffPlan;
      if (fields.notes !== undefined) updateData.notes = fields.notes;

      // Explicit photo removal: photoUrl === null means clear the photo
      if (preUploadedUrl === null) {
        updateData.photoUrl = null;
        updateData.photoKey = null;
      } else if (preUploadedUrl) {
        updateData.photoUrl = preUploadedUrl;
        if (preUploadedKey) updateData.photoKey = preUploadedKey;
      } else if (imageBase64 && mimeType) {
        // Fallback: inline base64 upload
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
      // Widen the query window by ±1 day to catch UTC dates that shift when converted to client local time
      const from = new Date(input.year, input.month - 1, 1);
      from.setDate(from.getDate() - 1);
      const to = new Date(input.year, input.month, 0, 23, 59, 59, 999);
      to.setDate(to.getDate() + 1);
      const logs = await getMealLogsForUser(input.userId, from, to);
      const byDate: Record<string, { meals: any[]; hasOutOfRange: boolean; treatCount: number; utcOffsetMins: number | null }> = {};
      for (const log of logs) {
        // Use the client's stored UTC offset to determine their local date
        const offsetMins: number = (log as any).utcOffsetMins ?? 0;
        const localMs = log.loggedAt.getTime() + offsetMins * 60 * 1000;
        const localDate = new Date(localMs);
        const key = `${localDate.getUTCFullYear()}-${String(localDate.getUTCMonth()+1).padStart(2,'0')}-${String(localDate.getUTCDate()).padStart(2,'0')}`;
        // Only include dates within the requested month
        const [ky, km] = key.split('-').map(Number);
        if (ky !== input.year || km !== input.month) continue;
        if (!byDate[key]) byDate[key] = { meals: [], hasOutOfRange: false, treatCount: 0, utcOffsetMins: offsetMins };
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
      // Scatter data — include meal metadata for click popover
      const scatter = curMeals
        .filter(m => m.hungerRating != null && m.fullnessRating != null)
        .map(m => ({
          h: m.hungerRating!,
          f: m.fullnessRating!,
          id: m.id,
          name: m.name ?? null,
          loggedAt: m.loggedAt.getTime(),
          utcOffsetMins: (m as any).utcOffsetMins as number ?? 0,
        }));
      // Out-of-zone meals: at least one rating present and outside ideal range
      const outOfZoneMeals = curMeals
        .filter(m => m.hungerRating != null || m.fullnessRating != null)
        .filter(m => {
          const hBad = m.hungerRating != null && (m.hungerRating < 3 || m.hungerRating > 4);
          const fBad = m.fullnessRating != null && (m.fullnessRating < 6 || m.fullnessRating > 7);
          return hBad || fBad;
        })
        .map(m => ({
          id: m.id,
          name: m.name ?? null,
          loggedAt: m.loggedAt.getTime(),
          utcOffsetMins: (m as any).utcOffsetMins as number ?? 0,
          hungerRating: m.hungerRating ?? null,
          fullnessRating: m.fullnessRating ?? null,
        }))
        .sort((a, b) => b.loggedAt - a.loggedAt); // newest first
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
      // Meal timing slots — k-means circular clustering
      const mealOnly = curLogs.filter(l => l.mealType === 'meal');
      // Use stored utcOffsetMins to convert UTC loggedAt to local time for timing
      const toLocalMins = (m: typeof mealOnly[0]) => {
        const utcMins = m.loggedAt.getUTCHours() * 60 + m.loggedAt.getUTCMinutes();
        const offset = (m as any).utcOffsetMins ?? 0;
        return ((utcMins + offset) % 1440 + 1440) % 1440;
      };
      const allMealMins = mealOnly
        .map(toLocalMins)
        .filter(t => t >= 240) // exclude midnight-4am artefacts
        .sort((a, b) => a - b);

      // Circular distance between two time-of-day values (minutes)
      const circDist = (a: number, b: number) => {
        const d = Math.abs(a - b) % 1440;
        return Math.min(d, 1440 - d);
      };
      // Circular mean of a set of minute values
      const circularMean = (vals: number[]) => {
        const TWO_PI = 2 * Math.PI;
        const sinSum = vals.reduce((s, v) => s + Math.sin(v / 1440 * TWO_PI), 0);
        const cosSum = vals.reduce((s, v) => s + Math.cos(v / 1440 * TWO_PI), 0);
        let angle = Math.atan2(sinSum / vals.length, cosSum / vals.length);
        if (angle < 0) angle += TWO_PI;
        return (angle / TWO_PI) * 1440;
      };
      // Run k-means for a given k, return WCSS (within-cluster sum of squares)
      const runKMeans = (pts: number[], k: number): { wcss: number; centroids: number[]; clusters: number[][] } => {
        if (pts.length < k) return { wcss: Infinity, centroids: [], clusters: [] };
        let centroids = Array.from({ length: k }, (_, i) =>
          360 + (i * (1200 - 360) / Math.max(k - 1, 1))
        );
        let clusters: number[][] = [];
        for (let iter = 0; iter < 100; iter++) {
          clusters = Array.from({ length: k }, () => []);
          for (const p of pts) {
            const nearest = centroids.reduce(
              (best, c, i) => circDist(p, c) < circDist(p, centroids[best]) ? i : best, 0
            );
            clusters[nearest].push(p);
          }
          const newCentroids = clusters.map((cl, i) =>
            cl.length > 0 ? circularMean(cl) : centroids[i]
          );
          if (newCentroids.every((c, i) => Math.abs(c - centroids[i]) < 0.5)) break;
          centroids = newCentroids;
        }
        const wcss = clusters.reduce((sum, cl, i) =>
          sum + cl.reduce((s, p) => s + Math.pow(circDist(p, centroids[i]), 2), 0), 0
        );
        return { wcss, centroids, clusters };
      };
      // Auto-detect numSlots using ratio-of-consecutive-improvements elbow method
      // Keep adding k while improvement[k] / improvement[k-1] >= 5%
      // (i.e., the new cluster still reduces variance meaningfully relative to the previous step)
      let numSlots = 0;
      let bestCentroids: number[] = [];
      let bestClusters: number[][] = [];
      if (allMealMins.length >= 2) {
        const maxK = Math.min(6, allMealMins.length);
        const wcssValues: number[] = [];
        for (let k = 1; k <= maxK; k++) {
          wcssValues.push(runKMeans(allMealMins, k).wcss);
        }
        // Compute improvements between consecutive k values
        const improvements: number[] = [];
        for (let i = 1; i < wcssValues.length; i++) {
          improvements.push(wcssValues[i - 1] - wcssValues[i]);
        }
        // Start at k=2 (always better than k=1 if we have data)
        let chosenK = Math.min(2, maxK);
        for (let i = 1; i < improvements.length; i++) {
          // ratio = how much this step improves relative to the previous step
          const ratio = improvements[i - 1] > 0 ? improvements[i] / improvements[i - 1] : 0;
          if (ratio >= 0.20) {
            chosenK = i + 2; // k is i+2 because improvements[0] = k=1->k=2
          } else {
            break;
          }
        }
        numSlots = chosenK;
        const result = runKMeans(allMealMins, numSlots);
        bestCentroids = result.centroids;
        bestClusters = result.clusters;
      }

      // Build slots from elbow-method k-means result
      // Reject tiny clusters: must have at least 3 meals AND at least 15% of total meals
      const minClusterSize = Math.max(3, Math.ceil(allMealMins.length * 0.15));
      const slots: { label: string; anchor: string; anchorMins: number; driftMin: number; count: number }[] = [];
      if (numSlots > 0 && bestCentroids.length > 0) {
        bestClusters
          .map((cl, i) => ({ cl, centroid: bestCentroids[i] }))
          .filter(({ cl }) => cl.length >= minClusterSize)
          .sort((a, b) => a.centroid - b.centroid)
          .forEach(({ cl, centroid }, i) => {
            const drift = cl.reduce((s, p) => s + circDist(p, centroid), 0) / cl.length;
            const h = Math.floor(centroid / 60) % 24;
            const m = Math.round(centroid % 60);
            const ampm = h >= 12 ? 'pm' : 'am';
            const h12 = h % 12 === 0 ? 12 : h % 12;
            slots.push({ label: `Meal ${i + 1}`, anchor: `${h12}:${String(m).padStart(2, '0')} ${ampm}`, anchorMins: centroid, driftMin: Math.round(drift), count: cl.length });
          });
      }
      // Consistency score
      let onTime = 0;
      const totalForConsistency = mealOnly.length;
      if (slots.length > 0) {
        for (const m of mealOnly) {
          const mins = toLocalMins(m);
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
        slots: slots.map(s => ({ label: s.label, anchor: s.anchor, driftMin: s.driftMin, count: s.count })),
        consistencyScore,
        totalForConsistency,
        hasTimingData: slots.length > 0,
        outOfZoneMeals,
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

  // ── Client: pre-upload a meal photo, returns S3 URL immediately ──────────
  // Call this as soon as the user selects a photo (before they tap Save).
  // The log/update procedures accept photoUrl directly to skip re-uploading.
  uploadPhoto: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.imageBase64, "base64");
      const ext = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
      const key = `meal-photos/${ctx.user.id}/${Date.now()}-${randomSuffix()}.${ext}`;
      const result = await storagePut(key, buffer, input.mimeType);
      return { photoUrl: result.url, photoKey: key };
    }),
});
