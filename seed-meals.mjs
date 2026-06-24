// Seed 30 days of realistic sample meal data for Jake (userId=1)
// Run: node seed-meals.mjs

import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  // Try to load from .env
  const env = readFileSync(".env", "utf8");
  for (const line of env.split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
}

const conn = await createConnection(process.env.DATABASE_URL);

const USER_ID = 1;
const now = new Date();

// Meal names pool
const mealNames = [
  "Scrambled eggs on toast", "Greek yoghurt with berries", "Oats with banana",
  "Chicken salad", "Tuna wrap", "Grilled salmon with veg", "Beef stir fry",
  "Pasta with tomato sauce", "Chicken and rice", "Veggie omelette",
  "Avocado toast", "Protein smoothie", "Cottage cheese bowl",
  "Steak with sweet potato", "Lentil soup", "Turkey sandwich",
];
const treatNames = [
  "Chocolate bar", "Ice cream", "Biscuits", "Cake slice", "Chips",
];
const portions = ["small", "medium", "large"];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }

const rows = [];

for (let d = 29; d >= 0; d--) {
  const base = new Date(now);
  base.setDate(base.getDate() - d);

  // 2-3 meals per day
  const mealCount = rand(2, 3);
  const mealTimes = [
    [7, 30], [12, 30], [18, 0], [20, 0]
  ].slice(0, mealCount);

  for (const [h, m] of mealTimes) {
    const loggedAt = new Date(base);
    loggedAt.setHours(h + rand(-1, 1), m + rand(-20, 20), 0, 0);

    // Mostly ideal, some out of range
    const ideal = Math.random() < 0.65;
    const hungerRating = ideal ? rand(3, 4) : (Math.random() < 0.5 ? rand(1, 2) : rand(5, 7));
    const fullnessRating = ideal ? rand(6, 7) : (Math.random() < 0.5 ? rand(4, 5) : rand(8, 10));

    rows.push([
      USER_ID,
      loggedAt,
      "meal",
      pick(mealNames),
      null, // photoUrl
      null, // photoKey
      pick(portions),
      hungerRating,
      fullnessRating,
      Math.random() < 0.1 ? 1 : 0, // isOffPlan ~10%
      null, // notes
    ]);
  }

  // ~40% chance of a treat
  if (Math.random() < 0.4) {
    const treatAt = new Date(base);
    treatAt.setHours(rand(14, 21), rand(0, 59), 0, 0);
    rows.push([
      USER_ID,
      treatAt,
      "treat",
      pick(treatNames),
      null,
      null,
      pick(portions),
      null, // no hunger for treats
      null,
      0,
      null,
    ]);
  }
}

console.log(`Inserting ${rows.length} meal log entries for user ${USER_ID}...`);

for (const row of rows) {
  await conn.execute(
    `INSERT INTO meal_logs (userId, loggedAt, mealType, name, photoUrl, photoKey, portionSize, hungerRating, fullnessRating, isOffPlan, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row
  );
}

console.log("Done.");
await conn.end();
