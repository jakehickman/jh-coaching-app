-- Custom SQL migration file, put your code below! --

-- Add checkInDay and stepGoal to client_profiles
ALTER TABLE `client_profiles`
  ADD COLUMN `checkInDay` enum('monday','tuesday','wednesday','thursday','friday','saturday','sunday'),
  ADD COLUMN `stepGoal` int;

-- Replace offPlanMeal boolean with offPlanMeals int counter in daily_logs
ALTER TABLE `daily_logs`
  ADD COLUMN `offPlanMeals` int DEFAULT 0;

-- Create check_in_submissions table
CREATE TABLE `check_in_submissions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `clientId` int NOT NULL,
  `coachId` int,
  `weekStartDate` date NOT NULL,
  `dietAdherence` enum('fully','mostly','partially','poorly'),
  `dietAdherenceReason` text,
  `wentWell` text,
  `challenges` text,
  `wins` text,
  `overallFeeling` int,
  `coachReply` text,
  `coachRepliedAt` timestamp NULL,
  `submittedAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);