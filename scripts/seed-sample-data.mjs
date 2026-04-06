import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const USER_ID = 1;

// Today = 2026-04-06. Build 28 days back from today.
function dateStr(daysAgo) {
  const d = new Date("2026-04-06T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}

// Realistic slow cut: start ~95 kg, lose ~0.3 kg/week
function weight(daysAgo) {
  const base = 95.0;
  const trend = -0.3 / 7; // kg per day
  const noise = (Math.sin(daysAgo * 7.3) * 0.4); // daily fluctuation
  return parseFloat((base + trend * (28 - daysAgo) + noise).toFixed(1));
}

// Delete existing sample logs (keep id 90001 which is the real one)
await conn.execute("DELETE FROM daily_logs WHERE userId = ? AND id != 90001", [USER_ID]);
await conn.execute("DELETE FROM measurements WHERE userId = ?", [USER_ID]);

// Insert daily logs for days 1-27 (day 0 = today already exists as id 90001, update its weight)
await conn.execute(
  "UPDATE daily_logs SET weight = ? WHERE id = 90001",
  [weight(0)]
);

const trainingTypes = ["Push", "Pull", "Legs", "Push", "Pull", "Legs", "Rest"];
for (let ago = 1; ago <= 27; ago++) {
  const date = dateStr(ago);
  const w = weight(ago);
  const dayOfWeek = ago % 7;
  const trainingType = trainingTypes[dayOfWeek];
  const trainingCompleted = trainingType !== "Rest" ? 1 : 0;
  const hungerLevel = 2 + Math.round(Math.sin(ago * 1.3) + 1); // 1-4
  const sleepQuality = 3 + Math.round(Math.cos(ago * 0.9)); // 2-4
  const sleepHours = parseFloat((7 + Math.sin(ago * 0.7) * 0.8).toFixed(1));
  const stepsCount = trainingCompleted ? 9000 + Math.round(Math.sin(ago) * 1500) : 6000 + Math.round(Math.cos(ago) * 1000);
  const offPlanMeal = ago % 7 === 6 ? 1 : 0; // off plan on rest days occasionally

  await conn.execute(
    `INSERT INTO daily_logs (userId, logDate, weight, hungerLevel, sleepQuality, sleepHours, stepsCount, trainingCompleted, trainingType, offPlanMeal, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [USER_ID, date, w, hungerLevel, sleepQuality, sleepHours, stepsCount, trainingCompleted, trainingType, offPlanMeal]
  );
}

// Insert 4 measurement sessions — one per week (on Mondays: days 6, 13, 20, 27)
const measureDays = [6, 13, 20, 27];
// Realistic measurements: waist shrinking, skinfolds reducing
const measureData = [
  // [waist, umb1-5, sup1-5]  — most recent first in terms of days ago
  { waist: 88.5, umb: [14.2, 14.0, 14.3, 14.1, 14.2], sup: [12.1, 12.0, 12.2, 12.1, 12.0] },
  { waist: 89.2, umb: [14.8, 14.6, 14.9, 14.7, 14.8], sup: [12.6, 12.5, 12.7, 12.6, 12.5] },
  { waist: 90.0, umb: [15.4, 15.2, 15.5, 15.3, 15.4], sup: [13.1, 13.0, 13.2, 13.1, 13.0] },
  { waist: 90.8, umb: [16.0, 15.8, 16.1, 15.9, 16.0], sup: [13.6, 13.5, 13.7, 13.6, 13.5] },
];

for (let i = 0; i < measureDays.length; i++) {
  const date = dateStr(measureDays[i]);
  const d = measureData[i];
  await conn.execute(
    `INSERT INTO measurements (userId, measureDate, waist,
      umbilical1, umbilical2, umbilical3, umbilical4, umbilical5,
      suprailiac1, suprailiac2, suprailiac3, suprailiac4, suprailiac5,
      createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [USER_ID, date, d.waist, ...d.umb, ...d.sup]
  );
}

console.log("Sample data inserted:");
console.log("  - 28 daily log entries (days 0-27)");
console.log("  - 4 measurement sessions (days 6, 13, 20, 27)");

await conn.end();
