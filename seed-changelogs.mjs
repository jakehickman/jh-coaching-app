import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Client IDs: Julie=990022, Geoff=1200026, Sam=2940138
// Coach ID: Jake=1
const clients = [990022, 1200026, 2940138];
const coachId = 1;

// ── Program change logs ──────────────────────────────────────────────────────
const programEntries = [
  // Julie — 4 entries spread over last 4 weeks
  {
    userId: 990022, coachId, note: "Week 2 program update — increased volume on lower body",
    changedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    changes: [
      { type: "modify", session: "Lower A", exercise: "Barbell Squat", field: "sets", oldValue: "3", newValue: "4" },
      { type: "modify", session: "Lower A", exercise: "Romanian Deadlift", field: "reps", oldValue: "10", newValue: "12" },
    ]
  },
  {
    userId: 990022, coachId, note: "Added accessory work for glutes",
    changedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
    changes: [
      { type: "add", session: "Lower B", exercise: "Hip Thrust", field: "sets", newValue: "3" },
      { type: "add", session: "Lower B", exercise: "Hip Thrust", field: "reps", newValue: "15" },
    ]
  },
  {
    userId: 990022, coachId, note: "Deload week — reduced intensity",
    changedAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
    changes: [
      { type: "modify", session: "Upper A", exercise: "Bench Press", field: "sets", oldValue: "4", newValue: "3" },
      { type: "modify", session: "Upper A", exercise: "Bench Press", field: "reps", oldValue: "8", newValue: "10" },
      { type: "modify", session: "Lower A", exercise: "Barbell Squat", field: "sets", oldValue: "4", newValue: "3" },
    ]
  },
  {
    userId: 990022, coachId, note: "Post-deload — ramping back up",
    changedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    changes: [
      { type: "modify", session: "Upper A", exercise: "Bench Press", field: "sets", oldValue: "3", newValue: "4" },
      { type: "modify", session: "Upper A", exercise: "Overhead Press", field: "reps", oldValue: "10", newValue: "8" },
      { type: "remove", session: "Upper B", exercise: "Dumbbell Lateral Raise" },
      { type: "add", session: "Upper B", exercise: "Cable Lateral Raise", field: "sets", newValue: "3" },
    ]
  },
  // Geoff — 3 entries
  {
    userId: 1200026, coachId, note: "Switched to PPL split",
    changedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
    changes: [
      { type: "add", session: "Push A", exercise: "Incline Dumbbell Press", field: "sets", newValue: "3" },
      { type: "add", session: "Pull A", exercise: "Seated Cable Row", field: "sets", newValue: "4" },
      { type: "remove", session: "Full Body A", exercise: "Machine Chest Press" },
    ]
  },
  {
    userId: 1200026, coachId, note: "Increased leg volume — client requested more quad work",
    changedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    changes: [
      { type: "add", session: "Legs A", exercise: "Leg Press", field: "sets", newValue: "4" },
      { type: "modify", session: "Legs A", exercise: "Hack Squat", field: "reps", oldValue: "10", newValue: "12" },
    ]
  },
  // Sam — 2 entries
  {
    userId: 2940138, coachId, note: "Initial program setup",
    changedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
    changes: [
      { type: "add", session: "Upper A", exercise: "Barbell Bench Press", field: "sets", newValue: "4" },
      { type: "add", session: "Upper A", exercise: "Barbell Row", field: "sets", newValue: "4" },
      { type: "add", session: "Lower A", exercise: "Barbell Squat", field: "sets", newValue: "4" },
    ]
  },
  {
    userId: 2940138, coachId, note: "Adjusted rep ranges for hypertrophy focus",
    changedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    changes: [
      { type: "modify", session: "Upper A", exercise: "Barbell Bench Press", field: "reps", oldValue: "5", newValue: "8-10" },
      { type: "modify", session: "Upper A", exercise: "Barbell Row", field: "reps", oldValue: "5", newValue: "8-10" },
      { type: "modify", session: "Lower A", exercise: "Barbell Squat", field: "reps", oldValue: "5", newValue: "8-10" },
    ]
  },
];

// ── Meal plan history ────────────────────────────────────────────────────────
const nutritionEntries = [
  // Julie
  {
    userId: 990022, coachId,
    trainingCalories: 2100, trainingProtein: 165, trainingCarbs: 220, trainingFat: 58,
    restCalories: 1800, restProtein: 155, restCarbs: 160, restFat: 60,
    note: "Week 1 — starting macros",
    changedAt: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000),
  },
  {
    userId: 990022, coachId,
    trainingCalories: 1950, trainingProtein: 165, trainingCarbs: 190, trainingFat: 55,
    restCalories: 1700, restProtein: 155, restCarbs: 140, restFat: 58,
    note: "Slight deficit increase — progress slowing",
    changedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
  },
  // Geoff
  {
    userId: 1200026, coachId,
    trainingCalories: 2800, trainingProtein: 200, trainingCarbs: 310, trainingFat: 75,
    restCalories: 2400, restProtein: 190, restCarbs: 240, restFat: 72,
    note: "Maintenance phase macros",
    changedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
  },
  {
    userId: 1200026, coachId,
    trainingCalories: 3000, trainingProtein: 210, trainingCarbs: 340, trainingFat: 78,
    restCalories: 2600, restProtein: 200, restCarbs: 270, restFat: 75,
    note: "Transitioning to gaining phase — increasing carbs",
    changedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  // Sam
  {
    userId: 2940138, coachId,
    trainingCalories: 2300, trainingProtein: 180, trainingCarbs: 240, trainingFat: 65,
    restCalories: 2000, restProtein: 170, restCarbs: 180, restFat: 62,
    note: "Initial nutrition setup",
    changedAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000),
  },
];

// ── Cardio change logs ───────────────────────────────────────────────────────
const cardioEntries = [
  // Julie
  {
    userId: 990022, coachId, note: "Increasing cardio for fat loss phase",
    changedAt: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000),
    changes: [
      { field: "stepGoal", oldValue: "8000", newValue: "10000" },
      { field: "lissSessionsPerWeek", oldValue: "2", newValue: "3" },
    ]
  },
  {
    userId: 990022, coachId, note: "Deload week — reduced cardio",
    changedAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
    changes: [
      { field: "lissSessionsPerWeek", oldValue: "3", newValue: "2" },
      { field: "lissMinutesPerSession", oldValue: "45", newValue: "30" },
    ]
  },
  // Geoff
  {
    userId: 1200026, coachId, note: "Added LISS for maintenance",
    changedAt: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000),
    changes: [
      { field: "lissSessionsPerWeek", oldValue: null, newValue: "2" },
      { field: "lissMinutesPerSession", oldValue: null, newValue: "40" },
    ]
  },
  // Sam
  {
    userId: 2940138, coachId, note: "Initial cardio targets",
    changedAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000),
    changes: [
      { field: "stepGoal", oldValue: null, newValue: "9000" },
      { field: "lissSessionsPerWeek", oldValue: null, newValue: "2" },
      { field: "lissMinutesPerSession", oldValue: null, newValue: "35" },
    ]
  },
  {
    userId: 2940138, coachId, note: "Increased steps — client hitting goal consistently",
    changedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    changes: [
      { field: "stepGoal", oldValue: "9000", newValue: "11000" },
    ]
  },
];

// Insert all
console.log("Inserting program change logs...");
for (const e of programEntries) {
  await conn.execute(
    'INSERT INTO program_change_logs (userId, coachId, changes, note, changedAt) VALUES (?, ?, ?, ?, ?)',
    [e.userId, e.coachId, JSON.stringify(e.changes), e.note, e.changedAt]
  );
}

console.log("Inserting meal plan history...");
for (const e of nutritionEntries) {
  await conn.execute(
    'INSERT INTO meal_plan_history (userId, coachId, trainingCalories, trainingProtein, trainingCarbs, trainingFat, restCalories, restProtein, restCarbs, restFat, note, changedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [e.userId, e.coachId, e.trainingCalories, e.trainingProtein, e.trainingCarbs, e.trainingFat, e.restCalories, e.restProtein, e.restCarbs, e.restFat, e.note, e.changedAt]
  );
}

console.log("Inserting cardio change logs...");
for (const e of cardioEntries) {
  await conn.execute(
    'INSERT INTO cardio_change_logs (userId, coachId, changes, note, changedAt) VALUES (?, ?, ?, ?, ?)',
    [e.userId, e.coachId, JSON.stringify(e.changes), e.note, e.changedAt]
  );
}

console.log("Done.");
await conn.end();
