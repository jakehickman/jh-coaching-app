import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../_core/trpc";
import { adminProcedure } from "./shared";
import * as db from "../db";

export const usersRouter = router({
  list: adminProcedure.query(() => db.getAllUsers()),
  clients: adminProcedure.query(({ ctx }) => db.getAllClients(ctx.user.id)),
  setApproved: adminProcedure
    .input(z.object({ userId: z.number(), approved: z.boolean() }))
    .mutation(({ input }) => db.setUserApproved(input.userId, input.approved)),
  delete: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(({ ctx, input }) => {
      if (input.userId === ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete your own account" });
      return db.deleteUser(input.userId);
    }),
  pendingCount: adminProcedure.query(() => db.getPendingApprovalCount()),
});
