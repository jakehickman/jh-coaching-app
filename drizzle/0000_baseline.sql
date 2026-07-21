CREATE TABLE `cardio_change_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`coachId` int,
	`changes` json NOT NULL,
	`note` text,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cardio_change_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `check_in_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`questionId` int NOT NULL,
	`value` text,
	`elaboration` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `check_in_answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `check_in_cycles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`dueDate` date NOT NULL,
	`status` enum('upcoming','submitted') NOT NULL DEFAULT 'upcoming',
	`submissionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `check_in_cycles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `check_in_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`dueDate` date NOT NULL,
	`submissionId` int,
	`skipped` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `check_in_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `check_in_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`questionText` text NOT NULL,
	`type` enum('single_choice','free_text') NOT NULL,
	`options` json,
	`displayOrder` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `check_in_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `check_in_questions_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `check_in_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`coachId` int,
	`weekStartDate` date NOT NULL,
	`dietWeighedFoods` enum('every_meal','most_meals','some_meals','rarely','never'),
	`dietMealPrepAccuracy` enum('every_meal','most_meals','some_meals','rarely','never'),
	`dietExtrasFrequency` enum('never','one_two_days','few_days','most_days','every_day'),
	`dietAddedFats` enum('light_spray','small_amount','one_tsp_or_more','no_added_fats'),
	`dietMealTiming` enum('never','one_two_days','few_days','most_days','every_day'),
	`dietOffPlanQuality` enum('very_close','somewhat_close','not_very_close','very_different','no_off_plan_meals'),
	`sleepBedtimeConsistency` enum('never','one_two_days','few_days','most_days','every_day'),
	`adherenceBarrier` enum('no_issues','hunger','cravings','social_events','busy_time','poor_planning','low_motivation','travel_disruption','other'),
	`barrierExplain` text,
	`weeklyAssessment` enum('executed_exactly','mostly_followed','inconsistent','didnt_follow'),
	`reviewedAt` timestamp,
	`coachNotes` text,
	`changesNotes` text,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `check_in_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_phases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`label` enum('Gaining','Mini Cut','Fat Loss','Contest Prep','Maintenance') NOT NULL,
	`startDate` date NOT NULL,
	`endDate` date,
	`notes` text,
	`start_weight` float,
	`target_weight` float,
	`target_rate` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_phases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`coachId` int,
	`displayName` varchar(128),
	`startDate` date,
	`notes` text,
	`checkInDay` enum('monday','tuesday','wednesday','thursday','friday','saturday','sunday'),
	`stepGoal` int,
	`liss_sessions_per_week` int,
	`liss_minutes_per_session` int,
	`photoType` enum('standard','athlete') NOT NULL DEFAULT 'standard',
	`nutritionMode` enum('meal_plan','macros') NOT NULL DEFAULT 'meal_plan',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_question_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`questionId` int NOT NULL,
	`active` boolean NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_question_overrides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coaching_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachId` int NOT NULL,
	`clientId` int NOT NULL,
	`noteDate` date NOT NULL,
	`content` text NOT NULL,
	`category` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coaching_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`logDate` date NOT NULL,
	`weight` float,
	`sleepHours` float,
	`caffeineServings` float,
	`trainingCompleted` boolean DEFAULT false,
	`trainingType` varchar(64),
	`stepsCount` int,
	`lissMinutes` int,
	`sleepQuality` int,
	`hungerLevel` int,
	`stressLevel` int,
	`offPlanMeals` int DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `device_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(512) NOT NULL,
	`platform` enum('ios','android') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `device_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `equipment_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`exerciseName` varchar(128) NOT NULL,
	`presetName` varchar(256) NOT NULL,
	`lastSettings` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `equipment_presets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exercise_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`chest` float DEFAULT 0,
	`frontDelts` float DEFAULT 0,
	`sideDelts` float DEFAULT 0,
	`triceps` float DEFAULT 0,
	`lats` float DEFAULT 0,
	`upperBack` float DEFAULT 0,
	`rearDelts` float DEFAULT 0,
	`biceps` float DEFAULT 0,
	`quads` float DEFAULT 0,
	`hams` float DEFAULT 0,
	`glutes` float DEFAULT 0,
	`gluteMed` float DEFAULT 0,
	`calves` float DEFAULT 0,
	`abs` float DEFAULT 0,
	`customGroups` json,
	`videoUrl` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `exercise_library_id` PRIMARY KEY(`id`),
	CONSTRAINT `exercise_library_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `food_servings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`foodId` int NOT NULL,
	`label` varchar(128) NOT NULL,
	`grams` float NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `food_servings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `habit_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`habitId` int NOT NULL,
	`clientId` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `habit_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `habit_completions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`habitId` int NOT NULL,
	`clientId` int NOT NULL,
	`completedDate` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `habit_completions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `habits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coachId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`scope` enum('daily','per_meal') NOT NULL DEFAULT 'daily',
	`frequency` enum('daily','x_per_week') NOT NULL DEFAULT 'daily',
	`targetDays` int DEFAULT 7,
	`startDate` date,
	`sortOrder` int NOT NULL DEFAULT 0,
	`deleted` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `habits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invite_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`coachId` int NOT NULL,
	`label` varchar(128),
	`profileEmail` varchar(320),
	`usedByUserId` int,
	`usedAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invite_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `invite_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `macro_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`coachId` int,
	`dayType` enum('training','rest') NOT NULL,
	`meals` json,
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `macro_targets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meal_habit_completions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`habitId` int NOT NULL,
	`clientId` int NOT NULL,
	`mealLogId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meal_habit_completions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meal_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`loggedAt` timestamp NOT NULL,
	`mealType` enum('meal','treat') NOT NULL,
	`name` varchar(256),
	`photoUrl` text,
	`photoKey` varchar(512),
	`portionSize` enum('small','medium','large'),
	`hungerRating` int,
	`fullnessRating` int,
	`isOffPlan` boolean NOT NULL DEFAULT false,
	`notes` text,
	`utcOffsetMins` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meal_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meal_plan_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`coachId` int,
	`trainingCalories` int,
	`trainingProtein` int,
	`trainingCarbs` int,
	`trainingFat` int,
	`restCalories` int,
	`restProtein` int,
	`restCarbs` int,
	`restFat` int,
	`note` text,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meal_plan_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meal_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`coachId` int,
	`dayType` enum('training','rest') NOT NULL,
	`meals` json,
	`supplements` json,
	`totalCalories` int,
	`totalProtein` int,
	`totalCarbs` int,
	`totalFat` int,
	`treatAllowanceKcal` int,
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meal_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `measurements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`measureDate` date NOT NULL,
	`waist` float,
	`hips` float,
	`umbilical1` float,
	`umbilical2` float,
	`umbilical3` float,
	`umbilical4` float,
	`umbilical5` float,
	`suprailiac1` float,
	`suprailiac2` float,
	`suprailiac3` float,
	`suprailiac4` float,
	`suprailiac5` float,
	`calf1` float,
	`calf2` float,
	`calf3` float,
	`calf4` float,
	`calf5` float,
	`thigh1` float,
	`thigh2` float,
	`thigh3` float,
	`thigh4` float,
	`thigh5` float,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `measurements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meso_cycles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`coachId` int,
	`mesoName` varchar(128) NOT NULL,
	`startDate` date NOT NULL,
	`closedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meso_cycles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meso_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mesoId` int NOT NULL,
	`userId` int NOT NULL,
	`sessionDate` date,
	`weekNumber` int,
	`dayLabel` varchar(64),
	`exercises` json,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meso_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nutrition_foods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fdcId` int,
	`name` varchar(256) NOT NULL,
	`calories` float NOT NULL DEFAULT 0,
	`protein` float NOT NULL DEFAULT 0,
	`carbs` float NOT NULL DEFAULT 0,
	`fiber` float NOT NULL DEFAULT 0,
	`fat` float NOT NULL DEFAULT 0,
	`servingUnit` varchar(64),
	`servingGrams` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nutrition_foods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `onboarding_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`fullName` varchar(128),
	`email` varchar(320),
	`age` int,
	`heightCm` float,
	`currentWeightKg` float,
	`goalWeightKg` float,
	`primaryGoal` varchar(256),
	`trainingExperience` varchar(64),
	`trainingFrequency` varchar(64),
	`equipment` varchar(64),
	`dietApproach` varchar(64),
	`injuries` text,
	`lifestyle` text,
	`additionalInfo` text,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`reviewed` boolean NOT NULL DEFAULT false,
	CONSTRAINT `onboarding_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `program_change_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`coachId` int,
	`changes` json NOT NULL,
	`note` text,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `program_change_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `progress_photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`coachId` int NOT NULL,
	`weekNumber` int NOT NULL,
	`pose` varchar(64) NOT NULL,
	`photoUrl` text NOT NULL,
	`s3Key` varchar(512) NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `progress_photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shopping_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`category` varchar(64),
	`itemName` varchar(128) NOT NULL,
	`quantity` varchar(64),
	`checked` boolean DEFAULT false,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shopping_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `timeline_milestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`milestoneDate` date NOT NULL,
	`title` varchar(128) NOT NULL,
	`description` text,
	`category` varchar(64),
	`completed` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `timeline_milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `training_programs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`coachId` int,
	`programName` varchar(128),
	`days` json,
	`schedule` json,
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `training_programs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`approved` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `weekly_check_ins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`weekStartDate` date NOT NULL,
	`avgWeight` float,
	`weightChange` float,
	`trainingAdherence` int,
	`nutritionAdherence` int,
	`overallFeeling` int,
	`wins` text,
	`challenges` text,
	`nextWeekGoals` text,
	`coachFeedback` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_check_ins_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionDate` date NOT NULL,
	`dayLabel` varchar(128) NOT NULL,
	`exercises` json NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workout_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_cardio_change_logs_userId` ON `cardio_change_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_cardio_change_logs_coachId` ON `cardio_change_logs` (`coachId`);--> statement-breakpoint
CREATE INDEX `idx_check_in_submissions_coachId` ON `check_in_submissions` (`coachId`);--> statement-breakpoint
CREATE INDEX `idx_client_phases_clientId` ON `client_phases` (`clientId`);--> statement-breakpoint
CREATE INDEX `idx_client_profiles_userId` ON `client_profiles` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_client_profiles_coachId` ON `client_profiles` (`coachId`);--> statement-breakpoint
CREATE INDEX `idx_coaching_notes_coachId` ON `coaching_notes` (`coachId`);--> statement-breakpoint
CREATE INDEX `idx_daily_logs_userId` ON `daily_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_device_tokens_userId` ON `device_tokens` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_equipment_presets_userId` ON `equipment_presets` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_habit_assignments_clientId` ON `habit_assignments` (`clientId`);--> statement-breakpoint
CREATE INDEX `idx_habit_completions_clientId` ON `habit_completions` (`clientId`);--> statement-breakpoint
CREATE INDEX `idx_habits_coachId` ON `habits` (`coachId`);--> statement-breakpoint
CREATE INDEX `idx_invite_tokens_coachId` ON `invite_tokens` (`coachId`);--> statement-breakpoint
CREATE INDEX `idx_macro_targets_userId` ON `macro_targets` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_macro_targets_coachId` ON `macro_targets` (`coachId`);--> statement-breakpoint
CREATE INDEX `idx_meal_habit_completions_clientId` ON `meal_habit_completions` (`clientId`);--> statement-breakpoint
CREATE INDEX `idx_meal_plan_history_userId` ON `meal_plan_history` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_meal_plan_history_coachId` ON `meal_plan_history` (`coachId`);--> statement-breakpoint
CREATE INDEX `idx_meal_plans_userId` ON `meal_plans` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_meal_plans_coachId` ON `meal_plans` (`coachId`);--> statement-breakpoint
CREATE INDEX `idx_measurements_userId` ON `measurements` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_meso_cycles_userId` ON `meso_cycles` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_meso_cycles_coachId` ON `meso_cycles` (`coachId`);--> statement-breakpoint
CREATE INDEX `idx_meso_sessions_userId` ON `meso_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_onboarding_submissions_userId` ON `onboarding_submissions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_onboarding_submissions_email` ON `onboarding_submissions` (`email`);--> statement-breakpoint
CREATE INDEX `idx_program_change_logs_userId` ON `program_change_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_program_change_logs_coachId` ON `program_change_logs` (`coachId`);--> statement-breakpoint
CREATE INDEX `idx_progress_photos_coachId` ON `progress_photos` (`coachId`);--> statement-breakpoint
CREATE INDEX `idx_shopping_items_userId` ON `shopping_items` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_timeline_milestones_userId` ON `timeline_milestones` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_training_programs_userId` ON `training_programs` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_training_programs_coachId` ON `training_programs` (`coachId`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_weekly_check_ins_userId` ON `weekly_check_ins` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_workout_sessions_userId` ON `workout_sessions` (`userId`);