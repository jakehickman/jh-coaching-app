ALTER TABLE `check_in_submissions`
  ADD COLUMN `weeklyAssessment` ENUM('executed_exactly','mostly_followed','inconsistent','didnt_follow') NULL
  AFTER `barrierExplain`;
