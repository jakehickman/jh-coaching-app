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
  }),

  // Users (admin)
  users: router({
    list: adminProcedure.query(() => db.getAllUsers()),
    clients: adminProcedure.query(({ ctx }) => db.getAllClients(ctx.user.id)),
    setApproved: adminProcedure
      .input(z.object({ userId: z.number(), approved: z.boolean() }))
      .mutation(({ input }) => db.setUserApproved(input.userId, input.approved)),
    delete: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(({ ctx, input }) => {
        if (input.userId === ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot delete your own account' });
        return db.deleteUser(input.userId);
      }),
    pendingCount: adminProcedure.query(() => db.getPendingApprovalCount()),
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
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          measureDate: z.string().optional(),
          waist: z.number().nullable().optional(),
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
          programName: z.string().nullable().optional(),
          days: z.any().optional(),
          schedule: z.any().optional(),
          notes: z.string().nullable().optional(),
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
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteCoachingNote(input.id)),
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          noteDate: z.string().optional(),
          content: z.string().optional(),
          category: z.string().optional(),
        })
      )
      .mutation(({ input }) => db.updateCoachingNote(input)),
  }),

  // (old weeklyCheckIns router removed — replaced by checkIn router below)

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
          videoUrl: z.string().nullish(),
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

  // Workout Sessions
  workoutSessions: router({
    // Client: list their own sessions
    list: protectedProcedure.query(({ ctx }) => db.listWorkoutSessions(ctx.user.id)),
    // Admin: list sessions for a specific client
    listForClient: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => db.listWorkoutSessions(input.userId)),
    // Client: save a session (upsert by userId+sessionDate+dayLabel)
    save: protectedProcedure
      .input(
        z.object({
          sessionDate: z.string(), // yyyy-mm-dd
          dayLabel: z.string(),
          exercises: z.array(
            z.object({
              name: z.string(),
              substitutedFor: z.string().nullable().optional(),
              equipmentDetails: z.string().nullable().optional(),
              exerciseNotes: z.string().nullable().optional(),
              sets: z.array(
                z.object({
                  weight: z.number().nullable().optional(),
                  reps: z.number().nullable().optional(),
                  notes: z.string().nullable().optional(),
                  completed: z.boolean().optional(),
                })
              ),
            })
          ),
          notes: z.string().nullable().optional(),
        })
      )
      .mutation(({ ctx, input }) => db.saveWorkoutSession({ userId: ctx.user.id, ...input })),
    // Client: delete a session
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => db.deleteWorkoutSession(input.id, ctx.user.id)),
  }),

  // Onboarding submissions
  onboarding: router({
    // Public: submit onboarding form (no auth required)
    submit: publicProcedure
      .input(
        z.object({
          fullName: z.string().min(1),
          email: z.string().email(),
          age: z.number().int().min(13).max(100).optional(),
          heightCm: z.number().positive().optional(),
          currentWeightKg: z.number().positive().optional(),
          goalWeightKg: z.number().positive().optional(),
          primaryGoal: z.string().optional(),
          trainingExperience: z.string().optional(),
          trainingFrequency: z.string().optional(),
          equipment: z.string().optional(),
          dietApproach: z.string().optional(),
          injuries: z.string().optional(),
          lifestyle: z.string().optional(),
          additionalInfo: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user?.id ?? null;
        return db.createOnboardingSubmission({ ...input, userId });
      }),
    // Admin: list all submissions
    list: adminProcedure.query(() => db.listOnboardingSubmissions()),
    // Admin: mark as reviewed
    markReviewed: adminProcedure
      .input(z.object({ id: z.number(), reviewed: z.boolean() }))
      .mutation(({ input }) => db.markOnboardingReviewed(input.id, input.reviewed)),
  }),

  // Check-in submissions
  checkIn: router({
    // Client: submit or update their check-in for the current week
    submit: protectedProcedure
      .input(z.object({
        weekStartDate: z.string(), // yyyy-mm-dd (Monday)
        // Section 1: Execution Accuracy
        execPortionEstimate: z.enum(["never","once_twice","few_days","most_days"]).optional(),
        execUntrackedExtras: z.enum(["never","once_twice","few_days","most_days"]).optional(),
        execChangedFoods: z.enum(["never","once_twice","few_days","most_days"]).optional(),
        execMissedMeals: z.enum(["never","once_twice","few_days","most_days"]).optional(),

        // Section 2: Adherence Barrier
        adherenceBarrier: z.enum(["no_issues","hunger","cravings","social_events","busy_time","poor_planning","low_motivation","travel_disruption","other"]).optional(),
        barrierExplain: z.string().max(500).optional(),
        // Section 3: Weekly Self-Assessment
        weeklyAssessment: z.enum(["executed_exactly","mostly_followed","inconsistent","didnt_follow"]).optional(),
        // Section 4: Focus for Next Week
        focusNextWeek: z.string().max(300).optional(),
      }))
      .mutation(({ ctx, input }) =>
        db.submitCheckIn({ clientId: ctx.user.id, ...input })
      ),
    // Client: list their own check-ins
    myList: protectedProcedure.query(({ ctx }) =>
      db.listCheckInsForClient(ctx.user.id)
    ),
    // Client: get check-in for a specific week
    myWeek: protectedProcedure
      .input(z.object({ weekStartDate: z.string() }))
      .query(({ ctx, input }) =>
        db.getCheckInForWeek(ctx.user.id, input.weekStartDate)
      ),
    // Coach: list check-ins for a client
    clientList: adminProcedure
      .input(z.object({ clientId: z.number() }))
      .query(({ input }) => db.listCheckInsForClient(input.clientId)),
    // Coach: mark a check-in as reviewed / unreviewed
    markReviewed: adminProcedure
      .input(z.object({ id: z.number(), reviewed: z.boolean() }))
      .mutation(({ input }) => db.markCheckInReviewed(input.id, input.reviewed)),
    // Coach: get the latest check-in submission per client (for indicator badges)
    latestPerClient: adminProcedure.query(() => db.getLatestCheckInPerClient()),
    // Coach: get list of clients whose check-in is overdue this week
    overdueClients: adminProcedure.query(async ({ ctx }) => {
      const profiles = await db.getAllClients(ctx.user.id);
      const allCheckIns = await db.getAllCheckInsPerClient();

      const dayMap: Record<string, number> = {
        monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
        friday: 5, saturday: 6, sunday: 0,
      };

      // Today at UTC midnight
      const now = new Date();
      const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      const result: { clientId: number; dueDate: Date }[] = [];

      for (const profile of profiles) {
        if (!profile.checkInDay || !profile.startDate) continue;

        const assignedJsDay = dayMap[profile.checkInDay]; // JS day: 0=Sun..6=Sat
        if (assignedJsDay === undefined) continue;

        // Parse startDate as UTC midnight
        const startUtc = new Date(Date.UTC(
          new Date(profile.startDate).getUTCFullYear(),
          new Date(profile.startDate).getUTCMonth(),
          new Date(profile.startDate).getUTCDate()
        ));

        // First expected check-in: first occurrence of assignedJsDay on or after startDate
        const startJsDay = startUtc.getUTCDay();
        const daysUntilFirst = (assignedJsDay - startJsDay + 7) % 7; // 0 = same day
        const firstCheckInUtc = new Date(startUtc);
        firstCheckInUtc.setUTCDate(startUtc.getUTCDate() + daysUntilFirst);

        // If first scheduled check-in is in the future, skip
        if (firstCheckInUtc > todayUtc) continue;

        // Build set of all submission dates for this client (UTC midnight timestamps)
        const clientSubmissions = allCheckIns
          .filter((c: any) => c.clientId === profile.userId)
          .map((c: any) => new Date(Date.UTC(
            new Date(c.submittedAt).getUTCFullYear(),
            new Date(c.submittedAt).getUTCMonth(),
            new Date(c.submittedAt).getUTCDate()
          )).getTime());

        // Iterate all scheduled dates from first to today
        let overdueDate: Date | null = null;
        const scheduled = new Date(firstCheckInUtc);
        while (scheduled <= todayUtc) {
          const scheduledTime = scheduled.getTime();
          const overdueThreshold = scheduledTime + 7 * 24 * 60 * 60 * 1000;

          // Only flag if today is strictly after scheduledDate + 7 days
          if (todayUtc.getTime() > overdueThreshold) {
            // Check if there is any submission on or after this scheduled date
            // (within the 7-day window: from scheduledDate to scheduledDate + 6 days)
            const nextScheduled = scheduledTime + 7 * 24 * 60 * 60 * 1000;
            const hasSubmission = clientSubmissions.some(
              (t: number) => t >= scheduledTime && t < nextScheduled
            );
            if (!hasSubmission) {
              overdueDate = new Date(scheduled);
              break; // found the earliest missed check-in — client is overdue
            }
          }
          // Advance to next scheduled date
          scheduled.setUTCDate(scheduled.getUTCDate() + 7);
        }

        if (overdueDate) {
          result.push({ clientId: profile.userId, dueDate: overdueDate });
        }
      }

      return result;
    }),
    // Coach: delete a check-in submission
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteCheckIn(input.id)),
  }),

  // Client profile extended (check-in day + step goal) — coach sets these
  clientConfig: router({
    // Coach: update check-in day and step goal for a client
    update: adminProcedure
      .input(z.object({
        userId: z.number(),
        checkInDay: z.enum(["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]).nullable().optional(),
        stepGoal: z.number().int().min(0).nullable().optional(),
      }))
      .mutation(({ input }) => {
        const { userId, ...data } = input;
        return db.updateClientProfileExtended(userId, data);
      }),
  }),

  // Habits
  habits: router({
    // Coach: list all habits they created
    list: adminProcedure.query(({ ctx }) => db.listHabitsByCoach(ctx.user.id)),

    // Coach: create a habit
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(128),
        description: z.string().optional(),
        frequency: z.enum(["daily", "x_per_week"]),
        targetDays: z.number().int().min(1).max(7).optional(),
        startDate: z.string().optional(),
      }))
      .mutation(({ ctx, input }) => db.createHabit({ ...input, coachId: ctx.user.id, startDate: input.startDate as any })),

    // Coach: update a habit
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(128).optional(),
        description: z.string().optional(),
        frequency: z.enum(["daily", "x_per_week"]).optional(),
        targetDays: z.number().int().min(1).max(7).optional(),
        startDate: z.string().optional(),
      }))
      .mutation(({ ctx, input }) => {
        const { id, ...data } = input;
        return db.updateHabit(id, ctx.user.id, { ...data, startDate: data.startDate as any });
      }),

    // Coach: soft-delete a habit
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => db.deleteHabit(input.id, ctx.user.id)),

    // Coach: get assignments for a habit
    getAssignments: adminProcedure
      .input(z.object({ habitId: z.number() }))
      .query(({ input }) => db.getHabitAssignments(input.habitId)),

    // Coach: set (replace) assignments for a habit
    setAssignments: adminProcedure
      .input(z.object({ habitId: z.number(), clientIds: z.array(z.number()) }))
      .mutation(({ input }) => db.setHabitAssignments(input.habitId, input.clientIds)),

    // Client: list assigned habits
    myHabits: protectedProcedure.query(({ ctx }) => db.listAssignedHabitsForClient(ctx.user.id)),

    // Client: toggle completion for today
    toggleCompletion: protectedProcedure
      .input(z.object({ habitId: z.number(), date: z.string() }))
      .mutation(({ ctx, input }) => db.toggleHabitCompletion(input.habitId, ctx.user.id, input.date)),

    // Client: get completions (last 30 days by default)
    myCompletions: protectedProcedure
      .input(z.object({ fromDate: z.string().optional() }))
      .query(({ ctx, input }) => db.getHabitCompletionsForClient(ctx.user.id, input.fromDate)),

    // Coach: get completions for a specific client
    clientCompletions: adminProcedure
      .input(z.object({ clientId: z.number(), fromDate: z.string().optional() }))
      .query(({ input }) => db.getHabitCompletionsForCoach(input.clientId, input.fromDate)),

    // Coach: get assigned habits for a specific client
    clientHabits: adminProcedure
      .input(z.object({ clientId: z.number() }))
      .query(({ input }) => db.listAssignedHabitsForClient(input.clientId)),
  }),
});
export type AppRouter = typeof appRouter;
