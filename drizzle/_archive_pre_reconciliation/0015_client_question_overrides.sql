CREATE TABLE `client_question_overrides` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `clientId` int NOT NULL,
  `questionId` int NOT NULL,
  `active` boolean NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `client_question_overrides_clientId_questionId_unique` (`clientId`, `questionId`)
);
