import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { adminProcedure } from "./shared";
import * as db from "../db";

export const questionsRouter = router({
  /** PUBLIC (coach + client): list all questions ordered by displayOrder */
  list: protectedProcedure.query(async () => {
    return db.listCheckInQuestions();
  }),

  /** PUBLIC (coach + client): list only active questions */
  listActive: protectedProcedure.query(async () => {
    return db.listActiveCheckInQuestions();
  }),

  /** ADMIN: create or update a question */
  upsert: adminProcedure
    .input(
      z.object({
        id: z.number().optional(),
        slug: z.string().min(1).max(64),
        questionText: z.string().min(1),
        type: z.enum(["single_choice", "free_text"]),
        options: z.array(z.string()).nullable().optional(),
        displayOrder: z.number().int(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db.upsertCheckInQuestion(input);
      return { success: true };
    }),

  /** ADMIN: toggle a question active/inactive */
  toggle: adminProcedure
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      await db.toggleCheckInQuestion(input.id, input.active);
      return { success: true };
    }),

  /** ADMIN: delete a question (also deletes all its answers) */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteCheckInQuestion(input.id);
      return { success: true };
    }),

  /** ADMIN: reorder questions by providing an ordered array of IDs */
  reorder: adminProcedure
    .input(z.object({ orderedIds: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      await db.reorderCheckInQuestions(input.orderedIds);
      return { success: true };
    }),

  /** Get answers for a specific submission (coach or the submitting client) */
  getAnswers: protectedProcedure
    .input(z.object({ submissionId: z.number() }))
    .query(async ({ input }) => {
      return db.getAnswersForSubmission(input.submissionId);
    }),

  /** Save answers for a submission */
  saveAnswers: protectedProcedure
    .input(
      z.object({
        submissionId: z.number(),
        answers: z.array(
          z.object({
            questionId: z.number(),
            value: z.string().nullable(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      await db.saveCheckInAnswers(input.submissionId, input.answers);
      return { success: true };
    }),
});
