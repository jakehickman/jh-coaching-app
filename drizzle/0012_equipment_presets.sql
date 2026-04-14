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
