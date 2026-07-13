import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";

export const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  // ─── Mobile: register a push notification device token ───────────────────
  registerDeviceToken: protectedProcedure
    .input(z.object({
      token: z.string().min(1).max(512),
      platform: z.enum(["ios", "android"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.upsertDeviceToken(ctx.user.id, input.token, input.platform);
      return { success: true } as const;
    }),

  // ─── Mobile: deregister a push notification device token (on logout) ─────
  unregisterDeviceToken: protectedProcedure
    .input(z.object({ token: z.string().min(1).max(512) }))
    .mutation(async ({ input }) => {
      await db.deleteDeviceToken(input.token);
      return { success: true } as const;
    }),
});
