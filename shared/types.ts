/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

/** Keys of the muscle groups tracked in the exercise library and training volume tables. */
export type MuscleKey =
  | "chest"
  | "frontDelts"
  | "sideDelts"
  | "triceps"
  | "lats"
  | "upperBack"
  | "rearDelts"
  | "biceps"
  | "quads"
  | "hams"
  | "glutes"
  | "calves"
  | "abs";
