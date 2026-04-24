import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  insertProgressPhoto,
  getProgressPhotosByWeek,
  getProgressPhotosForCompare,
  deleteProgressPhoto,
  getProgressPhotoWeeks,
} from "../db";
import { storagePut } from "../storage";
import { STANDARD_POSES, ATHLETE_POSES } from "../../drizzle/schema";

const ALL_POSES = [...STANDARD_POSES, ...ATHLETE_POSES] as const;

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

export const progressPhotosRouter = router({
  // Upload a photo for a specific client, week, and pose
  upload: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        weekNumber: z.number().int().positive(),
        pose: z.string(),
        // base64-encoded image data (without data: prefix)
        imageBase64: z.string(),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Coach only" });
      }
      const buffer = Buffer.from(input.imageBase64, "base64");
      const ext = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
      const s3Key = `progress-photos/${input.clientId}/w${input.weekNumber}-${input.pose}-${randomSuffix()}.${ext}`;
      const { url } = await storagePut(s3Key, buffer, input.mimeType);
      await insertProgressPhoto({
        clientId: input.clientId,
        coachId: ctx.user.id,
        weekNumber: input.weekNumber,
        pose: input.pose,
        photoUrl: url,
        s3Key,
      });
      return { url };
    }),

  // Get all photos for a client + week
  getByWeek: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive(), weekNumber: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return getProgressPhotosByWeek(input.clientId, input.weekNumber);
    }),

  // Get photos for two weeks (for comparison)
  getForCompare: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        weekA: z.number().int().positive(),
        weekB: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return getProgressPhotosForCompare(input.clientId, input.weekA, input.weekB);
    }),

  // Delete a photo
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const s3Key = await deleteProgressPhoto(input.id, ctx.user.id);
      if (!s3Key) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  // Get list of weeks that have photos for a client
  getWeeks: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return getProgressPhotoWeeks(input.clientId);
    }),
});
