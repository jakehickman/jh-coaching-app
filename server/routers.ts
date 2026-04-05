import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "./db";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Client profile
  profile: router({
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
          goalWeight: z.number().optional(),
          startWeight: z.number().optional(),
          showDate: z.string().optional(),
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
          goalWeight: z.number().optional(),
          startWeight: z.number().optional(),
          showDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.upsertClientProfile(input)),
  }),

  // Users (admin)
  users: router({
    list: adminProcedure.query(() => db.getAllUsers()),
    clients: adminProcedure.query(({ ctx }) => db.getAllClients(ctx.user.id)),
  }),

  // Daily Logs
  dailyLog: router({
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
          offPlanMeal: z.boolean().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.upsertDailyLog({ userId: ctx.user.id, ...input })
      ),
  }),

  // Measurements
  measurements: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getMeasurements(ctx.user.id)
    ),
    listForClient: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => db.getMeasurements(input.userId)),
    add: protectedProcedure
      .input(
        z.object({
          measureDate: z.string(),
          waist: z.number().optional(),
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
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => db.deleteMeasurement(input.id, ctx.user.id)),
  }),

  // Meal Plans
  mealPlan: router({
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
          notes: z.string().nullable().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.upsertMealPlan({ coachId: ctx.user.id, ...input })
      ),
  }),

  // Shopping List
  shopping: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getShoppingItems(ctx.user.id)
    ),
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
  }),

  // Training Program
  training: router({
    get: protectedProcedure.query(async ({ ctx }) =>
      (await db.getTrainingProgram(ctx.user.id)) ?? null
    ),
    getForClient: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => (await db.getTrainingProgram(input.userId)) ?? null),
    upsert: adminProcedure
      .input(
        z.object({
          userId: z.number(),
          programName: z.string().optional(),
          days: z.any().optional(),
          schedule: z.any().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.upsertTrainingProgram({ coachId: ctx.user.id, ...input })
      ),
    listAll: adminProcedure.query(() => db.listAllTrainingPrograms()),
  }),

  // MESO Cycles
  meso: router({
    cycles: protectedProcedure.query(({ ctx }) =>
      db.getMesoCycles(ctx.user.id)
    ),
    cyclesForClient: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => db.getMesoCycles(input.userId)),
    sessions: protectedProcedure
      .input(z.object({ mesoId: z.number() }))
      .query(({ input }) => db.getMesoSessions(input.mesoId)),
    upsertSession: protectedProcedure
      .input(
        z.object({
          id: z.number().optional(),
          mesoId: z.number(),
          sessionDate: z.string().optional(),
          weekNumber: z.number().optional(),
          dayLabel: z.string().optional(),
          exercises: z.any().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.upsertMesoSession({ userId: ctx.user.id, ...input })
      ),
  }),

  // Timeline
  timeline: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getTimelineMilestones(ctx.user.id)
    ),
    listForClient: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => db.getTimelineMilestones(input.userId)),
    toggle: protectedProcedure
      .input(z.object({ id: z.number(), completed: z.boolean() }))
      .mutation(({ input }) => db.toggleMilestone(input.id, input.completed)),
  }),

  // Coaching Notes
  notes: router({
    list: adminProcedure
      .input(z.object({ clientId: z.number() }))
      .query(({ input }) => db.getCoachingNotes(input.clientId)),
    add: adminProcedure
      .input(
        z.object({
          clientId: z.number(),
          noteDate: z.string(),
          content: z.string(),
          category: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.addCoachingNote({ coachId: ctx.user.id, ...input })
      ),
  }),

  // Weekly Check-ins
  checkIn: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getWeeklyCheckIns(ctx.user.id)
    ),
    listForClient: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => db.getWeeklyCheckIns(input.userId)),
    upsert: protectedProcedure
      .input(
        z.object({
          weekStartDate: z.string(),
          avgWeight: z.number().optional(),
          weightChange: z.number().optional(),
          trainingAdherence: z.number().min(0).max(100).optional(),
          nutritionAdherence: z.number().min(0).max(100).optional(),
          overallFeeling: z.number().min(1).max(10).optional(),
          wins: z.string().optional(),
          challenges: z.string().optional(),
          nextWeekGoals: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.upsertWeeklyCheckIn({ userId: ctx.user.id, ...input })
      ),
    addCoachFeedback: adminProcedure
      .input(
        z.object({
          userId: z.number(),
          weekStartDate: z.string(),
          coachFeedback: z.string(),
        })
      )
      .mutation(({ input }) =>
        db.upsertWeeklyCheckIn({ userId: input.userId, weekStartDate: input.weekStartDate, coachFeedback: input.coachFeedback })
      ),
  }),

  // Exercise Library
  exerciseLibrary: router({
    list: protectedProcedure.query(() => db.listExercises()),
    upsert: adminProcedure
      .input(
        z.object({
          id: z.number().optional(),
          name: z.string(),
          chest: z.number().optional(),
          frontDelts: z.number().optional(),
          sideDelts: z.number().optional(),
          triceps: z.number().optional(),
          lats: z.number().optional(),
          upperBack: z.number().optional(),
          rearDelts: z.number().optional(),
          biceps: z.number().optional(),
          quads: z.number().optional(),
          hams: z.number().optional(),
          glutes: z.number().optional(),
          calves: z.number().optional(),
          abs: z.number().optional(),
          customGroups: z.any().optional(),
          videoUrl: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.upsertExercise(input as any)),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteExercise(input.id)),
  }),

  // Nutrition Foods
  nutritionFoods: router({
    list: protectedProcedure.query(() => db.listNutritionFoods()),
    upsert: adminProcedure
      .input(
        z.object({
          id: z.number().optional(),
          name: z.string(),
          calories: z.number(),
          protein: z.number(),
          carbs: z.number(),
          fiber: z.number(),
          fat: z.number(),
          servingUnit: z.string().nullable().optional(),
          servingGrams: z.number().nullable().optional(),
        })
      )
      .mutation(({ input }) => db.upsertNutritionFood(input as any)),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteNutritionFood(input.id)),
  }),
});
export type AppRouter = typeof appRouter;
