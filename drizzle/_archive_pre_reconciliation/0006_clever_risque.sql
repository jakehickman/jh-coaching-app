ALTER TABLE `daily_logs` RENAME COLUMN `caffeineIntake` TO `caffeineServings`;--> statement-breakpoint
ALTER TABLE `daily_logs` MODIFY COLUMN `caffeineServings` float;--> statement-breakpoint
ALTER TABLE `daily_logs` ADD `sleepQuality` int;--> statement-breakpoint
ALTER TABLE `daily_logs` DROP COLUMN `energyLevel`;--> statement-breakpoint
ALTER TABLE `daily_logs` DROP COLUMN `stressLevel`;