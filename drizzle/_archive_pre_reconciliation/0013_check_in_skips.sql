CREATE TABLE `check_in_skips` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `clientId` int NOT NULL,
  `coachId` int NOT NULL,
  `weekStartDate` date NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now())
);
