-- Adds indexes on the userId/coachId/clientId/email columns that nearly every
-- query in server/db.ts filters on, across the 32 tables that have them.
-- Purely additive — CREATE INDEX does not touch existing data or app behavior.
--
-- NOTE ON HOW THIS WAS GENERATED: drizzle-kit's migration journal
-- (drizzle/meta/_journal.json) is 10 migrations behind the current
-- drizzle/schema.ts (it last tracked migration 0008, but schema.ts now has
-- 32 tables vs. the 14 tables in that snapshot) — migrations 0009-0018 were
-- evidently hand-written directly rather than through `drizzle-kit generate`.
-- Running `drizzle-kit generate` right now tries to recreate everything
-- since 0008 as if it were new (confirmed by test-running it — it opens an
-- interactive prompt asking whether already-existing columns are
-- "created" or "renamed from" other columns). So this file was hand-written
-- to match the existing 0009-0018 convention instead, and should be applied
-- directly (e.g. via a MySQL client) rather than through `drizzle-kit migrate`.
--
-- The journal being out of sync will affect any future `drizzle-kit generate`
-- too, not just this change — worth reconciling in its own pass (e.g. via
-- `drizzle-kit introspect` against the live DB) separately from this fix.

CREATE INDEX `idx_users_email` ON `users` (`email`);
CREATE INDEX `idx_client_profiles_userId` ON `client_profiles` (`userId`);
CREATE INDEX `idx_client_profiles_coachId` ON `client_profiles` (`coachId`);
CREATE INDEX `idx_daily_logs_userId` ON `daily_logs` (`userId`);
CREATE INDEX `idx_measurements_userId` ON `measurements` (`userId`);
CREATE INDEX `idx_meal_plans_userId` ON `meal_plans` (`userId`);
CREATE INDEX `idx_meal_plans_coachId` ON `meal_plans` (`coachId`);
CREATE INDEX `idx_macro_targets_userId` ON `macro_targets` (`userId`);
CREATE INDEX `idx_macro_targets_coachId` ON `macro_targets` (`coachId`);
CREATE INDEX `idx_shopping_items_userId` ON `shopping_items` (`userId`);
CREATE INDEX `idx_training_programs_userId` ON `training_programs` (`userId`);
CREATE INDEX `idx_training_programs_coachId` ON `training_programs` (`coachId`);
CREATE INDEX `idx_meso_cycles_userId` ON `meso_cycles` (`userId`);
CREATE INDEX `idx_meso_cycles_coachId` ON `meso_cycles` (`coachId`);
CREATE INDEX `idx_meso_sessions_userId` ON `meso_sessions` (`userId`);
CREATE INDEX `idx_timeline_milestones_userId` ON `timeline_milestones` (`userId`);
CREATE INDEX `idx_coaching_notes_coachId` ON `coaching_notes` (`coachId`);
CREATE INDEX `idx_weekly_check_ins_userId` ON `weekly_check_ins` (`userId`);
CREATE INDEX `idx_workout_sessions_userId` ON `workout_sessions` (`userId`);
CREATE INDEX `idx_onboarding_submissions_userId` ON `onboarding_submissions` (`userId`);
CREATE INDEX `idx_onboarding_submissions_email` ON `onboarding_submissions` (`email`);
CREATE INDEX `idx_habits_coachId` ON `habits` (`coachId`);
CREATE INDEX `idx_habit_assignments_clientId` ON `habit_assignments` (`clientId`);
CREATE INDEX `idx_habit_completions_clientId` ON `habit_completions` (`clientId`);
CREATE INDEX `idx_meal_habit_completions_clientId` ON `meal_habit_completions` (`clientId`);
CREATE INDEX `idx_check_in_submissions_coachId` ON `check_in_submissions` (`coachId`);
CREATE INDEX `idx_equipment_presets_userId` ON `equipment_presets` (`userId`);
CREATE INDEX `idx_check_in_cycles_clientId` ON `check_in_cycles` (`clientId`);
CREATE INDEX `idx_check_in_history_clientId` ON `check_in_history` (`clientId`);
CREATE INDEX `idx_meal_plan_history_userId` ON `meal_plan_history` (`userId`);
CREATE INDEX `idx_meal_plan_history_coachId` ON `meal_plan_history` (`coachId`);
CREATE INDEX `idx_progress_photos_coachId` ON `progress_photos` (`coachId`);
CREATE INDEX `idx_program_change_logs_userId` ON `program_change_logs` (`userId`);
CREATE INDEX `idx_program_change_logs_coachId` ON `program_change_logs` (`coachId`);
CREATE INDEX `idx_cardio_change_logs_userId` ON `cardio_change_logs` (`userId`);
CREATE INDEX `idx_cardio_change_logs_coachId` ON `cardio_change_logs` (`coachId`);
CREATE INDEX `idx_client_question_overrides_clientId` ON `client_question_overrides` (`clientId`);
CREATE INDEX `idx_client_phases_clientId` ON `client_phases` (`clientId`);
CREATE INDEX `idx_invite_tokens_coachId` ON `invite_tokens` (`coachId`);
CREATE INDEX `idx_meal_logs_userId` ON `meal_logs` (`userId`);
CREATE INDEX `idx_device_tokens_userId` ON `device_tokens` (`userId`);
