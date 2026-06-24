// Reseed Jake's meals: clear 3-meal majority with consistent times
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('/home/ubuntu/jh-coaching-app/.env', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);

const conn = await mysql.createConnection(env.DATABASE_URL);

// Delete existing seed meals for Jake (userId=1)
await conn.execute("DELETE FROM meal_logs WHERE userId = 1");

const now = new Date();
const rows = [];

for (let d = 29; d >= 0; d--) {
  const day = new Date(now);
  day.setDate(day.getDate() - d);

  // 22 out of 30 days: 3 meals (clear majority)
  const mealCount = d % 5 === 0 ? 2 : 3; // 6 two-meal days, 24 three-meal days

  // Meal times: breakfast ~7:30, lunch ~12:30, dinner ~18:30 (±15 min noise)
  const noise = () => Math.round((Math.random() - 0.5) * 30);
  const times = [
    [7, 30 + noise()],
    [12, 30 + noise()],
    [18, 30 + noise()],
  ].slice(0, mealCount);

  const mealNames = [
    ['Eggs & toast', 'Oats & fruit', 'Protein shake', 'Avocado toast'],
    ['Chicken salad', 'Tuna wrap', 'Beef stir fry', 'Pasta'],
    ['Salmon & veg', 'Steak & salad', 'Chicken & rice', 'Lamb & potatoes'],
  ];

  for (let s = 0; s < mealCount; s++) {
    const [h, m] = times[s];
    const mealTime = new Date(day);
    mealTime.setHours(h, Math.max(0, Math.min(59, m)), 0, 0);

    const hunger = 2 + Math.floor(Math.random() * 4); // 2-5
    const fullness = 5 + Math.floor(Math.random() * 4); // 5-8
    const isOffPlan = Math.random() < 0.08 ? 1 : 0;
    const portion = ['small', 'medium', 'large'][Math.floor(Math.random() * 3)];
    const name = mealNames[s][Math.floor(Math.random() * mealNames[s].length)];

    rows.push([1, mealTime, 'meal', name, null, null, portion, hunger, fullness, isOffPlan, null]);
  }

  // ~40% of days: add a treat
  if (Math.random() < 0.4) {
    const treatTime = new Date(day);
    treatTime.setHours(15, 0 + Math.round(Math.random() * 60), 0, 0);
    const treatSize = Math.random() < 0.5 ? 'small' : Math.random() < 0.7 ? 'medium' : 'large';
    rows.push([1, treatTime, 'treat', 'Treat', null, null, treatSize, null, null, 0, null]);
  }
}

for (const row of rows) {
  await conn.execute(
    `INSERT INTO meal_logs (userId, loggedAt, mealType, name, photoUrl, photoKey, portionSize, hungerRating, fullnessRating, isOffPlan, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row
  );
}

await conn.end();
console.log(`Seeded ${rows.length} meal log entries for Jake.`);
