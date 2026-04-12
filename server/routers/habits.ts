import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { adminProcedure } from "./shared";
import * as db from "../db";

export const habitsRouter = router({
  list: adminProcedure.query(({ ctx }) => db.listHabitsByCoach(ctx.user.id)),
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      description: z.string().optional(),
      frequency: z.enum(["daily", "x_per_week"]),
      targetDays: z.number().int().min(1).max(7).optional(),
      startDate: z.string().optional(),
    }))
    .mutation(({ ctx, input }) =>
      db.createHabit({ ...input, coachId: ctx.user.id, startDate: input.startDate as any })
    ),
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
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => db.deleteHabit(input.id, ctx.user.id)),
  getAssignments: adminProcedure
    .input(z.object({ habitId: z.number() }))
    .query(({ input }) => db.getHabitAssignments(input.habitId)),
  setAssignments: adminProcedure
    .input(z.object({ habitId: z.number(), clientIds: z.array(z.number()) }))
    .mutation(({ input }) => db.setHabitAssignments(input.habitId, input.clientIds)),
  myHabits: protectedProcedure.query(({ ctx }) =>
    db.listAssignedHabitsForClient(ctx.user.id)
  ),
  toggleCompletion: protectedProcedure
    .input(z.object({ habitId: z.number(), date: z.string() }))
    .mutation(({ ctx, input }) =>
      db.toggleHabitCompletion(input.habitId, ctx.user.id, input.date)
    ),
  myCompletions: protectedProcedure
    .input(z.object({ fromDate: z.string().optional() }))
    .query(({ ctx, input }) =>
      db.getHabitCompletionsForClient(ctx.user.id, input.fromDate)
    ),
  clientCompletions: adminProcedure
    .input(z.object({ clientId: z.number(), fromDate: z.string().optional() }))
    .query(({ input }) =>
      db.getHabitCompletionsForClient(input.clientId, input.fromDate)
    ),
  clientHabits: adminProcedure
    .input(z.object({ clientId: z.number() }))
    .query(({ input }) => db.listAssignedHabitsForClient(input.clientId)),
});
