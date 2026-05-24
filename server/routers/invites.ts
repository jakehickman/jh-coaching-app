import crypto from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { adminProcedure } from "./shared";
import * as db from "../db";

export const invitesRouter = router({
  /** Coach creates a new invite token */
  create: adminProcedure
    .input(z.object({
      label: z.string().max(128).optional(),
      expiresInDays: z.number().int().min(1).max(365).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const token = crypto.randomBytes(24).toString("hex");
      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;
      await db.createInviteToken(ctx.user.id, input.label ?? null, token, expiresAt);
      return { token };
    }),

  /** Coach lists all their invite tokens */
  list: adminProcedure.query(({ ctx }) => db.listInviteTokens(ctx.user.id)),

  /** Coach deletes an invite token */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.deleteInviteToken(input.id)),

  /** Public: validate a token (used by the invite landing page) */
  validate: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const invite = await db.getInviteToken(input.token);
      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
      if (invite.usedByUserId) throw new TRPCError({ code: "FORBIDDEN", message: "Invite already used" });
      if (invite.expiresAt && invite.expiresAt < new Date())
        throw new TRPCError({ code: "FORBIDDEN", message: "Invite has expired" });
      return { valid: true, label: invite.label };
    }),
});
