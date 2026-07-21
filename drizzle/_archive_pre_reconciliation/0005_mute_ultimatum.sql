CREATE TABLE `nutrition_foods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`calories` float NOT NULL DEFAULT 0,
	`protein` float NOT NULL DEFAULT 0,
	`carbs` float NOT NULL DEFAULT 0,
	`fiber` float NOT NULL DEFAULT 0,
	`fat` float NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nutrition_foods_id` PRIMARY KEY(`id`)
);
