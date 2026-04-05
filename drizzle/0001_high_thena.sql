CREATE TABLE `client_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`coachId` int,
	`displayName` varchar(128),
	`startDate` date,
	`goalWeight` float,
	`startWeight` float,
	`showDate` date,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_profiles_id` PRIMARY KEY(`id`)
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
	`caffeineIntake` int,
	`trainingCompleted` boolean DEFAULT false,
	`trainingType` varchar(64),
	`stepsCount` int,
	`energyLevel` int,
	`hungerLevel` int,
	`stressLevel` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meal_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`coachId` int,
	`dayType` enum('training','rest') NOT NULL,
	`meals` json,
	`totalCalories` int,
	`totalProtein` int,
	`totalCarbs` int,
	`totalFat` int,
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meal_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `measurements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`measureDate` date NOT NULL,
	`weight` float,
	`chest` float,
	`waist` float,
	`hips` float,
	`leftArm` float,
	`rightArm` float,
	`leftThigh` float,
	`rightThigh` float,
	`leftCalf` float,
	`rightCalf` float,
	`neck` float,
	`shoulders` float,
	`bodyFatPercent` float,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `measurements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meso_cycles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`mesoName` varchar(64),
	`startDate` date,
	`endDate` date,
	`totalWeeks` int DEFAULT 4,
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
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `training_programs_id` PRIMARY KEY(`id`)
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
