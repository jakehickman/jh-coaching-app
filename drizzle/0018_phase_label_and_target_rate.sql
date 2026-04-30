-- Rename "General Fat Loss" to "Fat Loss" in existing rows
UPDATE `client_phases` SET `label` = 'Fat Loss' WHERE `label` = 'General Fat Loss';

-- Alter the enum to replace "General Fat Loss" with "Fat Loss"
ALTER TABLE `client_phases`
  MODIFY COLUMN `label` ENUM('Gaining','Mini Cut','Fat Loss','Contest Prep') NOT NULL;

-- Add targetRate column
ALTER TABLE `client_phases`
  ADD COLUMN `target_rate` VARCHAR(32) NULL;
