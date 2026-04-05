import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn);

// We'll use raw SQL for simplicity
async function run(sql, params = []) {
  await conn.execute(sql, params);
}

console.log("Seeding demo data for Jake H...");

// 1. Create demo user for Jake H (client)
await run(`INSERT IGNORE INTO users (openId, name, email, role, loginMethod, lastSignedIn) VALUES (?, ?, ?, ?, ?, NOW())`,
  ["demo-jake-h", "Jake H", "jake@demo.com", "user", "demo"]);

const [jakeRows] = await conn.execute(`SELECT id FROM users WHERE openId = 'demo-jake-h' LIMIT 1`);
const jakeId = jakeRows[0].id;
console.log(`Jake H user id: ${jakeId}`);

// 2. Client profile
await run(`INSERT INTO client_profiles (userId, displayName, startDate, startWeight, goalWeight, showDate, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE displayName=VALUES(displayName), startWeight=VALUES(startWeight), goalWeight=VALUES(goalWeight), showDate=VALUES(showDate)`,
  [jakeId, "Jake H", "2025-01-06", 90.5, 78.0, "2025-09-06", "First show prep. Competing in Men's Physique."]);

// 3. Daily logs (last 30 days)
const today = new Date();
const weights = [89.2, 89.0, 88.8, 88.9, 88.6, 88.4, 88.5, 88.2, 88.0, 87.9, 87.8, 87.6, 87.5, 87.4, 87.2, 87.0, 86.9, 86.8, 86.6, 86.5, 86.4, 86.2, 86.0, 85.9, 85.8, 85.6, 85.5, 85.4, 85.2, 85.0];
const trainingDays = [true, false, true, true, false, true, false, true, false, true, true, false, true, false, true, true, false, true, false, true, true, false, true, false, true, true, false, true, false, true];
const trainingTypes = ["Upper Body", null, "Lower Body", "Push", null, "Pull", null, "Legs", null, "Upper Body", "Lower Body", null, "Push", null, "Pull", "Legs", null, "Upper Body", null, "Lower Body", "Push", null, "Pull", null, "Legs", "Upper Body", null, "Lower Body", null, "Push"];

for (let i = 0; i < 30; i++) {
  const d = new Date(today);
  d.setDate(d.getDate() - (29 - i));
  const dateStr = d.toISOString().slice(0, 10);
  const energy = Math.floor(Math.random() * 3) + 6;
  const hunger = Math.floor(Math.random() * 3) + 5;
  const stress = Math.floor(Math.random() * 3) + 3;
  const sleep = (6.5 + Math.random() * 2).toFixed(1);
  const caffeine = trainingDays[i] ? 200 : 100;
  const steps = Math.floor(8000 + Math.random() * 4000);

  await run(`INSERT IGNORE INTO daily_logs (userId, logDate, weight, sleepHours, caffeineIntake, trainingCompleted, trainingType, stepsCount, energyLevel, hungerLevel, stressLevel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [jakeId, dateStr, weights[i], parseFloat(sleep), caffeine, trainingDays[i] ? 1 : 0, trainingTypes[i], steps, energy, hunger, stress]);
}
console.log("Daily logs seeded");

// 4. Measurements (every 2 weeks)
const measureDates = [
  { date: "2025-01-06", weight: 90.5, chest: 102, waist: 84, hips: 98, leftArm: 37, rightArm: 37.5, leftThigh: 60, rightThigh: 60.5, bodyFat: 18.5 },
  { date: "2025-01-20", weight: 89.2, chest: 101.5, waist: 83, hips: 97.5, leftArm: 37, rightArm: 37.5, leftThigh: 59.5, rightThigh: 60, bodyFat: 17.8 },
  { date: "2025-02-03", weight: 88.0, chest: 101, waist: 82, hips: 97, leftArm: 36.8, rightArm: 37.2, leftThigh: 59, rightThigh: 59.5, bodyFat: 17.2 },
  { date: "2025-02-17", weight: 86.8, chest: 100.5, waist: 80.5, hips: 96.5, leftArm: 36.5, rightArm: 37, leftThigh: 58.5, rightThigh: 59, bodyFat: 16.5 },
  { date: "2025-03-03", weight: 85.5, chest: 100, waist: 79, hips: 96, leftArm: 36.2, rightArm: 36.8, leftThigh: 58, rightThigh: 58.5, bodyFat: 15.8 },
];

for (const m of measureDates) {
  await run(`INSERT IGNORE INTO measurements (userId, measureDate, weight, chest, waist, hips, leftArm, rightArm, leftThigh, rightThigh, bodyFatPercent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [jakeId, m.date, m.weight, m.chest, m.waist, m.hips, m.leftArm, m.rightArm, m.leftThigh, m.rightThigh, m.bodyFat]);
}
console.log("Measurements seeded");

// 5. Training Program
const trainingProgram = {
  programName: "4-Day Upper/Lower Split",
  days: [
    {
      name: "Day 1 — Upper (Push Focus)",
      focus: "Chest, Shoulders, Triceps",
      exercises: [
        { name: "Incline Barbell Press", sets: "4", reps: "6-8", rest: "3 min", notes: "RPE 8" },
        { name: "Flat DB Press", sets: "3", reps: "10-12", rest: "2 min", notes: "" },
        { name: "Cable Lateral Raise", sets: "4", reps: "15-20", rest: "90s", notes: "Controlled eccentric" },
        { name: "Overhead Press (Smith)", sets: "3", reps: "10-12", rest: "2 min", notes: "" },
        { name: "Tricep Pushdown", sets: "3", reps: "12-15", rest: "60s", notes: "" },
        { name: "Overhead Tricep Extension", sets: "3", reps: "12-15", rest: "60s", notes: "" },
      ]
    },
    {
      name: "Day 2 — Lower (Quad Focus)",
      focus: "Quads, Glutes, Calves",
      exercises: [
        { name: "Barbell Back Squat", sets: "4", reps: "6-8", rest: "3 min", notes: "RPE 8" },
        { name: "Leg Press", sets: "3", reps: "12-15", rest: "2 min", notes: "" },
        { name: "Hack Squat", sets: "3", reps: "10-12", rest: "2 min", notes: "" },
        { name: "Leg Extension", sets: "3", reps: "15-20", rest: "90s", notes: "Pause at top" },
        { name: "Standing Calf Raise", sets: "4", reps: "15-20", rest: "60s", notes: "" },
        { name: "Seated Calf Raise", sets: "3", reps: "20-25", rest: "60s", notes: "" },
      ]
    },
    {
      name: "Day 3 — Upper (Pull Focus)",
      focus: "Back, Biceps, Rear Delts",
      exercises: [
        { name: "Weighted Pull-ups", sets: "4", reps: "6-8", rest: "3 min", notes: "Full ROM" },
        { name: "Barbell Row", sets: "4", reps: "8-10", rest: "2 min", notes: "Chest supported" },
        { name: "Seated Cable Row", sets: "3", reps: "10-12", rest: "90s", notes: "" },
        { name: "Face Pulls", sets: "3", reps: "15-20", rest: "60s", notes: "" },
        { name: "Barbell Curl", sets: "3", reps: "10-12", rest: "90s", notes: "" },
        { name: "Incline DB Curl", sets: "3", reps: "12-15", rest: "60s", notes: "" },
      ]
    },
    {
      name: "Day 4 — Lower (Hamstring Focus)",
      focus: "Hamstrings, Glutes, Adductors",
      exercises: [
        { name: "Romanian Deadlift", sets: "4", reps: "8-10", rest: "3 min", notes: "Feel the stretch" },
        { name: "Leg Curl (Lying)", sets: "4", reps: "10-12", rest: "2 min", notes: "" },
        { name: "Bulgarian Split Squat", sets: "3", reps: "10-12 each", rest: "2 min", notes: "" },
        { name: "Hip Thrust", sets: "3", reps: "12-15", rest: "2 min", notes: "" },
        { name: "Adductor Machine", sets: "3", reps: "15-20", rest: "60s", notes: "" },
        { name: "Leg Curl (Seated)", sets: "3", reps: "15-20", rest: "60s", notes: "" },
      ]
    }
  ],
  notes: "Progressive overload each week. Log all weights and reps. Rest days: Wed, Sat, Sun."
};

await run(`INSERT INTO training_programs (userId, coachId, programName, days, notes) VALUES (?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE programName=VALUES(programName), days=VALUES(days), notes=VALUES(notes)`,
  [jakeId, jakeId, trainingProgram.programName, JSON.stringify(trainingProgram.days), trainingProgram.notes]);
console.log("Training program seeded");

// 6. Meal Plans
const trainingMeals = [
  {
    name: "Meal 1 — Breakfast (7:00am)",
    items: [
      { food: "Oats", amount: "100g", calories: "380" },
      { food: "Whey Protein", amount: "1 scoop (30g)", calories: "120" },
      { food: "Blueberries", amount: "100g", calories: "57" },
      { food: "Almond Milk", amount: "200ml", calories: "30" },
    ],
    macros: { protein: "35g", carbs: "65g", fat: "8g" }
  },
  {
    name: "Meal 2 — Pre-Workout (12:00pm)",
    items: [
      { food: "White Rice", amount: "200g cooked", calories: "260" },
      { food: "Chicken Breast", amount: "180g", calories: "216" },
      { food: "Broccoli", amount: "150g", calories: "51" },
      { food: "Olive Oil", amount: "5ml", calories: "45" },
    ],
    macros: { protein: "50g", carbs: "55g", fat: "8g" }
  },
  {
    name: "Meal 3 — Post-Workout (4:00pm)",
    items: [
      { food: "White Rice", amount: "150g cooked", calories: "195" },
      { food: "Lean Beef Mince (5%)", amount: "150g", calories: "195" },
      { food: "Mixed Veg", amount: "100g", calories: "40" },
    ],
    macros: { protein: "40g", carbs: "42g", fat: "8g" }
  },
  {
    name: "Meal 4 — Dinner (7:30pm)",
    items: [
      { food: "Salmon Fillet", amount: "180g", calories: "360" },
      { food: "Sweet Potato", amount: "200g", calories: "172" },
      { food: "Asparagus", amount: "150g", calories: "34" },
    ],
    macros: { protein: "45g", carbs: "40g", fat: "18g" }
  },
  {
    name: "Meal 5 — Evening (10:00pm)",
    items: [
      { food: "Cottage Cheese", amount: "200g", calories: "140" },
      { food: "Casein Protein", amount: "1 scoop (30g)", calories: "120" },
    ],
    macros: { protein: "40g", carbs: "8g", fat: "4g" }
  },
];

const restMeals = [
  {
    name: "Meal 1 — Breakfast (8:00am)",
    items: [
      { food: "Eggs (whole)", amount: "3 large", calories: "210" },
      { food: "Egg Whites", amount: "4 whites", calories: "68" },
      { food: "Spinach", amount: "100g", calories: "23" },
      { food: "Avocado", amount: "50g", calories: "80" },
    ],
    macros: { protein: "35g", carbs: "5g", fat: "18g" }
  },
  {
    name: "Meal 2 — Lunch (1:00pm)",
    items: [
      { food: "Chicken Breast", amount: "200g", calories: "240" },
      { food: "Brown Rice", amount: "100g cooked", calories: "130" },
      { food: "Mixed Salad", amount: "150g", calories: "30" },
      { food: "Olive Oil Dressing", amount: "10ml", calories: "90" },
    ],
    macros: { protein: "50g", carbs: "28g", fat: "12g" }
  },
  {
    name: "Meal 3 — Dinner (7:00pm)",
    items: [
      { food: "Lean Beef Steak", amount: "200g", calories: "280" },
      { food: "Roasted Veg", amount: "200g", calories: "80" },
      { food: "Olive Oil", amount: "10ml", calories: "90" },
    ],
    macros: { protein: "50g", carbs: "15g", fat: "16g" }
  },
  {
    name: "Meal 4 — Evening (9:30pm)",
    items: [
      { food: "Greek Yoghurt (0%)", amount: "200g", calories: "120" },
      { food: "Casein Protein", amount: "1 scoop", calories: "120" },
    ],
    macros: { protein: "40g", carbs: "10g", fat: "2g" }
  },
];

await run(`INSERT INTO meal_plans (userId, coachId, dayType, meals, totalCalories, totalProtein, totalCarbs, totalFat, notes)
  VALUES (?, ?, 'training', ?, 2225, 210, 210, 46, ?)
  ON DUPLICATE KEY UPDATE meals=VALUES(meals), totalCalories=VALUES(totalCalories), totalProtein=VALUES(totalProtein), totalCarbs=VALUES(totalCarbs), totalFat=VALUES(totalFat)`,
  [jakeId, jakeId, JSON.stringify(trainingMeals), "Training day — higher carbs around training. Drink 3-4L water."]);

await run(`INSERT INTO meal_plans (userId, coachId, dayType, meals, totalCalories, totalProtein, totalCarbs, totalFat, notes)
  VALUES (?, ?, 'rest', ?, 1750, 175, 58, 48, ?)
  ON DUPLICATE KEY UPDATE meals=VALUES(meals), totalCalories=VALUES(totalCalories), totalProtein=VALUES(totalProtein), totalCarbs=VALUES(totalCarbs), totalFat=VALUES(totalFat)`,
  [jakeId, jakeId, JSON.stringify(restMeals), "Rest day — lower carbs, higher fat. Focus on protein and recovery."]);
console.log("Meal plans seeded");

// 7. Shopping List
const shoppingItems = [
  { category: "Proteins", items: [
    { name: "Chicken Breast", qty: "2kg" },
    { name: "Lean Beef Mince (5%)", qty: "1kg" },
    { name: "Salmon Fillets", qty: "6 fillets" },
    { name: "Eggs (large)", qty: "2 dozen" },
    { name: "Egg Whites (carton)", qty: "2 cartons" },
    { name: "Whey Protein", qty: "1 bag (2kg)" },
    { name: "Casein Protein", qty: "1 bag" },
    { name: "Cottage Cheese", qty: "4 x 200g" },
    { name: "Greek Yoghurt (0%)", qty: "4 x 200g" },
  ]},
  { category: "Carbs", items: [
    { name: "White Rice", qty: "5kg bag" },
    { name: "Brown Rice", qty: "1kg" },
    { name: "Oats", qty: "1kg" },
    { name: "Sweet Potato", qty: "2kg" },
  ]},
  { category: "Vegetables", items: [
    { name: "Broccoli", qty: "1kg" },
    { name: "Asparagus", qty: "2 bunches" },
    { name: "Spinach (baby)", qty: "2 bags" },
    { name: "Mixed Salad", qty: "2 bags" },
    { name: "Mixed Veg (frozen)", qty: "1kg" },
  ]},
  { category: "Fats & Condiments", items: [
    { name: "Olive Oil", qty: "500ml" },
    { name: "Avocado", qty: "4" },
    { name: "Almond Milk (unsweetened)", qty: "2L" },
  ]},
  { category: "Fruit", items: [
    { name: "Blueberries", qty: "500g" },
  ]},
];

let sortOrder = 0;
for (const cat of shoppingItems) {
  for (const item of cat.items) {
    await run(`INSERT IGNORE INTO shopping_items (userId, category, itemName, quantity, sortOrder) VALUES (?, ?, ?, ?, ?)`,
      [jakeId, cat.category, item.name, item.qty, sortOrder++]);
  }
}
console.log("Shopping list seeded");

// 8. MESO Cycle
await run(`INSERT IGNORE INTO meso_cycles (userId, mesoName, startDate, endDate, totalWeeks, notes) VALUES (?, ?, ?, ?, ?, ?)`,
  [jakeId, "MESO 1 — Accumulation", "2025-01-06", "2025-02-02", 4, "Hypertrophy focus. High volume, moderate intensity."]);

const [mesoRows] = await conn.execute(`SELECT id FROM meso_cycles WHERE userId = ? LIMIT 1`, [jakeId]);
const mesoId = mesoRows[0].id;

const mesoSessions = [
  { week: 1, day: "Day 1 — Upper Push", exercises: [
    { name: "Incline Barbell Press", sets: [{ weight: "80kg", reps: "8", rir: "3" }, { weight: "80kg", reps: "7", rir: "3" }, { weight: "80kg", reps: "7", rir: "3" }, { weight: "80kg", reps: "6", rir: "3" }] },
    { name: "Cable Lateral Raise", sets: [{ weight: "10kg", reps: "18", rir: "2" }, { weight: "10kg", reps: "17", rir: "2" }, { weight: "10kg", reps: "16", rir: "2" }, { weight: "10kg", reps: "15", rir: "2" }] },
  ]},
  { week: 1, day: "Day 2 — Lower Quad", exercises: [
    { name: "Barbell Back Squat", sets: [{ weight: "100kg", reps: "8", rir: "3" }, { weight: "100kg", reps: "7", rir: "3" }, { weight: "100kg", reps: "7", rir: "3" }, { weight: "100kg", reps: "6", rir: "3" }] },
    { name: "Leg Press", sets: [{ weight: "180kg", reps: "15", rir: "2" }, { weight: "180kg", reps: "14", rir: "2" }, { weight: "180kg", reps: "13", rir: "2" }] },
  ]},
  { week: 2, day: "Day 1 — Upper Push", exercises: [
    { name: "Incline Barbell Press", sets: [{ weight: "82.5kg", reps: "8", rir: "3" }, { weight: "82.5kg", reps: "7", rir: "3" }, { weight: "82.5kg", reps: "7", rir: "3" }, { weight: "82.5kg", reps: "6", rir: "3" }] },
    { name: "Cable Lateral Raise", sets: [{ weight: "11kg", reps: "17", rir: "2" }, { weight: "11kg", reps: "16", rir: "2" }, { weight: "11kg", reps: "15", rir: "2" }, { weight: "11kg", reps: "15", rir: "2" }] },
  ]},
  { week: 2, day: "Day 2 — Lower Quad", exercises: [
    { name: "Barbell Back Squat", sets: [{ weight: "102.5kg", reps: "8", rir: "3" }, { weight: "102.5kg", reps: "7", rir: "3" }, { weight: "102.5kg", reps: "7", rir: "3" }, { weight: "102.5kg", reps: "6", rir: "3" }] },
    { name: "Leg Press", sets: [{ weight: "185kg", reps: "15", rir: "2" }, { weight: "185kg", reps: "14", rir: "2" }, { weight: "185kg", reps: "13", rir: "2" }] },
  ]},
];

for (const s of mesoSessions) {
  await run(`INSERT IGNORE INTO meso_sessions (mesoId, userId, weekNumber, dayLabel, exercises) VALUES (?, ?, ?, ?, ?)`,
    [mesoId, jakeId, s.week, s.day, JSON.stringify(s.exercises)]);
}
console.log("MESO sessions seeded");

// 9. Timeline Milestones
const milestones = [
  { date: "2025-01-06", title: "Start of Prep", category: "Check-in", desc: "Starting weight: 90.5kg. 36 weeks out.", completed: true },
  { date: "2025-02-03", title: "4-Week Check-in", category: "Check-in", desc: "Assess progress, adjust calories if needed.", completed: true },
  { date: "2025-03-03", title: "8-Week Check-in", category: "Check-in", desc: "Mid-prep assessment. Expect 4-5kg down.", completed: true },
  { date: "2025-04-07", title: "12-Week Check-in", category: "Check-in", desc: "Transition to harder deficit phase.", completed: false },
  { date: "2025-05-05", title: "16-Week Check-in", category: "Check-in", desc: "Should be ~82kg by now.", completed: false },
  { date: "2025-06-02", title: "20-Week Check-in", category: "Check-in", desc: "Final push phase begins.", completed: false },
  { date: "2025-07-07", title: "24-Week Check-in", category: "Adjustment", desc: "Peak week planning begins.", completed: false },
  { date: "2025-08-25", title: "Peak Week Begins", category: "Peak Week", desc: "Carb manipulation, water management.", completed: false },
  { date: "2025-09-06", title: "Show Day", category: "Show Day", desc: "Men's Physique. Aim for stage weight ~78kg.", completed: false },
];

for (const m of milestones) {
  await run(`INSERT IGNORE INTO timeline_milestones (userId, milestoneDate, title, description, category, completed) VALUES (?, ?, ?, ?, ?, ?)`,
    [jakeId, m.date, m.title, m.desc, m.category, m.completed ? 1 : 0]);
}
console.log("Timeline milestones seeded");

// 10. Weekly check-ins
const checkInData = [
  { week: "2025-01-06", avgWeight: 90.2, change: null, training: 86, nutrition: 90, feeling: 7, wins: "Nailed all 4 training sessions. Nutrition on point.", challenges: "Hunger was high on rest days.", goals: "Stay consistent, hit 10k steps daily." },
  { week: "2025-01-13", avgWeight: 89.5, change: -0.7, training: 100, nutrition: 85, feeling: 7, wins: "5 training sessions. Weight moving well.", challenges: "Sleep was poor mid-week.", goals: "Improve sleep hygiene." },
  { week: "2025-01-20", avgWeight: 88.8, change: -0.7, training: 86, nutrition: 88, feeling: 8, wins: "Great energy levels. Strength maintained.", challenges: "Missed one session due to work.", goals: "Keep deficit consistent." },
  { week: "2025-01-27", avgWeight: 88.2, change: -0.6, training: 100, nutrition: 92, feeling: 8, wins: "Best week so far. All sessions hit.", challenges: "Cravings on Saturday.", goals: "Push through to 8-week mark." },
  { week: "2025-02-03", avgWeight: 87.5, change: -0.7, training: 86, nutrition: 87, feeling: 7, wins: "3kg down from start. On track.", challenges: "Fatigue building slightly.", goals: "Add extra rest, maintain performance." },
  { week: "2025-02-10", avgWeight: 86.8, change: -0.7, training: 86, nutrition: 85, feeling: 7, wins: "Waist measurement down 2cm.", challenges: "Hunger increasing.", goals: "Stay disciplined through hunger." },
];

for (const c of checkInData) {
  await run(`INSERT IGNORE INTO weekly_check_ins (userId, weekStartDate, avgWeight, weightChange, trainingAdherence, nutritionAdherence, overallFeeling, wins, challenges, nextWeekGoals)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [jakeId, c.week, c.avgWeight, c.change, c.training, c.nutrition, c.feeling, c.wins, c.challenges, c.goals]);
}
console.log("Weekly check-ins seeded");

console.log("\n✅ Demo data seeded successfully!");
console.log(`Jake H user ID: ${jakeId}`);
await conn.end();
