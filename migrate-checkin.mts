import { getDb } from './server/db.js';

const db = await getDb();
if (!db) { console.error('No DB'); process.exit(1); }

// Add new diet execution columns
await db.execute(`ALTER TABLE check_in_submissions
  ADD COLUMN dietWeighedFoods ENUM('every_meal','most_meals','some_meals','rarely','never') NULL,
  ADD COLUMN dietMealPrepAccuracy ENUM('every_meal','most_meals','some_meals','rarely','never') NULL,
  ADD COLUMN dietExtrasFrequency ENUM('never','one_two_days','few_days','most_days','every_day') NULL,
  ADD COLUMN dietAddedFats ENUM('light_spray','small_amount','one_tsp_or_more','no_added_fats') NULL,
  ADD COLUMN dietMealTiming ENUM('never','one_two_days','few_days','most_days','every_day') NULL,
  ADD COLUMN dietOffPlanQuality ENUM('very_close','somewhat_close','not_very_close','very_different','no_off_plan_meals') NULL`);
console.log('New columns added');

// Drop old exec columns
await db.execute(`ALTER TABLE check_in_submissions
  DROP COLUMN execPortionEstimate,
  DROP COLUMN execUntrackedExtras,
  DROP COLUMN execChangedFoods,
  DROP COLUMN execMissedMeals`);
console.log('Old columns dropped');

process.exit(0);
