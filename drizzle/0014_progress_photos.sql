-- Add photoType to client_profiles
ALTER TABLE `client_profiles`
  ADD COLUMN `photoType` ENUM('standard','athlete') NOT NULL DEFAULT 'standard';

-- Create progress_photos table
CREATE TABLE `progress_photos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `clientId` INT NOT NULL,
  `coachId` INT NOT NULL,
  `weekNumber` INT NOT NULL,
  `pose` VARCHAR(64) NOT NULL,
  `photoUrl` TEXT NOT NULL,
  `s3Key` VARCHAR(512) NOT NULL,
  `uploadedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
