-- Create check_in_questions table
CREATE TABLE `check_in_questions` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `slug` varchar(64) NOT NULL,
  `questionText` text NOT NULL,
  `type` enum('single_choice','free_text') NOT NULL,
  `options` json,
  `displayOrder` int NOT NULL DEFAULT 0,
  `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `check_in_questions_slug_unique` (`slug`)
);

-- Create check_in_answers table
CREATE TABLE `check_in_answers` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `submissionId` int NOT NULL,
  `questionId` int NOT NULL,
  `value` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);