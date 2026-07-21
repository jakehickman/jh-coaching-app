-- Migrate meso_cycles table to new schema:
-- Remove endDate, totalWeeks columns
-- Add coachId, closedAt columns
-- Make mesoName NOT NULL and longer
-- Make startDate NOT NULL

ALTER TABLE `meso_cycles`
  ADD COLUMN `coachId` int,
  ADD COLUMN `closedAt` timestamp,
  MODIFY COLUMN `mesoName` varchar(128) NOT NULL DEFAULT '',
  MODIFY COLUMN `startDate` date NOT NULL DEFAULT (CURRENT_DATE);

-- Clean up old columns (safe to drop - not used in new feature)
ALTER TABLE `meso_cycles`
  DROP COLUMN `endDate`,
  DROP COLUMN `totalWeeks`;
