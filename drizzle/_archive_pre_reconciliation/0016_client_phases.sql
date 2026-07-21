CREATE TABLE `client_phases` (
  `id` int AUTO_INCREMENT NOT NULL,
  `clientId` int NOT NULL,
  `label` enum('Gaining','Mini Cut','General Fat Loss','Contest Prep') NOT NULL,
  `startDate` date NOT NULL,
  `endDate` date,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `client_phases_id` PRIMARY KEY(`id`)
);
