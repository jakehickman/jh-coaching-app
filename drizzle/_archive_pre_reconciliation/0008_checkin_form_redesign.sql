-- Migration: redesign check_in_submissions table for new structured form
-- Drop old columns and add new structured columns

ALTER TABLE `check_in_submissions`
  DROP COLUMN IF EXISTS `dietAdherence`,
  DROP COLUMN IF EXISTS `dietAdherenceReason`,
  DROP COLUMN IF EXISTS `wentWell`,
  DROP COLUMN IF EXISTS `challenges`,
  DROP COLUMN IF EXISTS `wins`,
  DROP COLUMN IF EXISTS `overallFeeling`;

ALTER TABLE `check_in_submissions`
  ADD COLUMN IF NOT EXISTS `execPortionEstimate` ENUM('never','1_2_times','3_5_times','6_plus_times'),
  ADD COLUMN IF NOT EXISTS `execUntrackedExtras` ENUM('never','1_2_times','3_5_times','6_plus_times'),
  ADD COLUMN IF NOT EXISTS `execChangedFoods` ENUM('never','1_2_times','3_5_times','6_plus_times'),
  ADD COLUMN IF NOT EXISTS `execUnloggedItems` ENUM('never','1_2_times','3_5_times','6_plus_times'),
  ADD COLUMN IF NOT EXISTS `adherenceBarrier` ENUM('no_issues','hunger','cravings','social_events','busy_time','poor_planning','low_motivation','travel_disruption','other'),
  ADD COLUMN IF NOT EXISTS `barrierExplain` TEXT,
  ADD COLUMN IF NOT EXISTS `focusNextWeek` TEXT;
