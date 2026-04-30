import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Jake Hickman userId = 1, coachId = 1 (self as admin)
const JAKE = 1;
const COACH = 1;

// ─── Program change logs for Jake ────────────────────────────────────────────
const programLogs = [
  {
    userId: JAKE, coachId: COACH,
    changedAt: '2026-04-08 08:00:00',
    note: 'Week 1 program set up',
    changes: [
      { type: 'add', session: 'Push A', exercise: 'Bench Press', field: 'sets', oldValue: null, newValue: '4' },
      { type: 'add', session: 'Push A', exercise: 'Bench Press', field: 'reps', oldValue: null, newValue: '8-10' },
      { type: 'add', session: 'Pull A', exercise: 'Barbell Row', field: 'sets', oldValue: null, newValue: '4' },
      { type: 'add', session: 'Pull A', exercise: 'Barbell Row', field: 'reps', oldValue: null, newValue: '8-10' },
      { type: 'add', session: 'Legs A', exercise: 'Squat', field: 'sets', oldValue: null, newValue: '4' },
      { type: 'add', session: 'Legs A', exercise: 'Squat', field: 'reps', oldValue: null, newValue: '6-8' },
    ]
  },
  {
    userId: JAKE, coachId: COACH,
    changedAt: '2026-04-15 09:30:00',
    note: 'Swapped incline DB for incline barbell — better for shoulder health',
    changes: [
      { type: 'remove', session: 'Push A', exercise: 'Incline DB Press' },
      { type: 'add', session: 'Push A', exercise: 'Incline Barbell Press', field: 'sets', oldValue: null, newValue: '3' },
      { type: 'add', session: 'Push A', exercise: 'Incline Barbell Press', field: 'reps', oldValue: null, newValue: '8-10' },
    ]
  },
  {
    userId: JAKE, coachId: COACH,
    changedAt: '2026-04-19 10:00:00',
    note: 'Increased volume on legs — progressing well',
    changes: [
      { type: 'modify', session: 'Legs A', exercise: 'Squat', field: 'sets', oldValue: '4', newValue: '5' },
      { type: 'modify', session: 'Legs A', exercise: 'Romanian Deadlift', field: 'sets', oldValue: '3', newValue: '4' },
      { type: 'modify', session: 'Legs A', exercise: 'Romanian Deadlift', field: 'reps', oldValue: '10-12', newValue: '8-10' },
    ]
  },
  {
    userId: JAKE, coachId: COACH,
    changedAt: '2026-04-24 08:15:00',
    note: 'Deload week — reduced sets across the board',
    changes: [
      { type: 'modify', session: 'Push A', exercise: 'Bench Press', field: 'sets', oldValue: '4', newValue: '2' },
      { type: 'modify', session: 'Pull A', exercise: 'Barbell Row', field: 'sets', oldValue: '4', newValue: '2' },
      { type: 'modify', session: 'Legs A', exercise: 'Squat', field: 'sets', oldValue: '5', newValue: '2' },
    ]
  },
  {
    userId: JAKE, coachId: COACH,
    changedAt: '2026-04-28 09:00:00',
    note: 'Back to full volume post-deload, added cable fly for chest isolation',
    changes: [
      { type: 'modify', session: 'Push A', exercise: 'Bench Press', field: 'sets', oldValue: '2', newValue: '4' },
      { type: 'add', session: 'Push A', exercise: 'Cable Fly', field: 'sets', oldValue: null, newValue: '3' },
      { type: 'add', session: 'Push A', exercise: 'Cable Fly', field: 'reps', oldValue: null, newValue: '12-15' },
      { type: 'modify', session: 'Pull A', exercise: 'Barbell Row', field: 'sets', oldValue: '2', newValue: '4' },
      { type: 'modify', session: 'Legs A', exercise: 'Squat', field: 'sets', oldValue: '2', newValue: '5' },
    ]
  },
];

// ─── Cardio / Activity change logs for Jake ───────────────────────────────────
const cardioLogs = [
  {
    userId: JAKE, coachId: COACH,
    changedAt: '2026-04-08 08:00:00',
    note: 'Initial targets set',
    changes: [
      { field: 'stepGoal', oldValue: null, newValue: '8000' },
      { field: 'lissSessionsPerWeek', oldValue: null, newValue: '2' },
      { field: 'lissMinutesPerSession', oldValue: null, newValue: '30' },
    ]
  },
  {
    userId: JAKE, coachId: COACH,
    changedAt: '2026-04-16 10:00:00',
    note: 'Increased steps — hitting 8k easily',
    changes: [
      { field: 'stepGoal', oldValue: '8000', newValue: '10000' },
    ]
  },
  {
    userId: JAKE, coachId: COACH,
    changedAt: '2026-04-23 09:30:00',
    note: 'Deload week — reduced cardio',
    changes: [
      { field: 'lissSessionsPerWeek', oldValue: '2', newValue: '1' },
      { field: 'lissMinutesPerSession', oldValue: '30', newValue: '20' },
    ]
  },
  {
    userId: JAKE, coachId: COACH,
    changedAt: '2026-04-28 09:00:00',
    note: 'Back to full cardio post-deload',
    changes: [
      { field: 'lissSessionsPerWeek', oldValue: '1', newValue: '3' },
      { field: 'lissMinutesPerSession', oldValue: '20', newValue: '35' },
      { field: 'stepGoal', oldValue: '10000', newValue: '12000' },
    ]
  },
];

// ─── Meal plan history for Jake ───────────────────────────────────────────────
const mealLogs = [
  {
    userId: JAKE, coachId: COACH,
    changedAt: '2026-04-08 08:00:00',
    note: 'Initial macros — moderate deficit',
    trainingCalories: 2400, trainingProtein: 185, trainingCarbs: 240, trainingFat: 65,
    restCalories: 1900, restProtein: 185, restCarbs: 150, restFat: 60,
  },
  {
    userId: JAKE, coachId: COACH,
    changedAt: '2026-04-16 10:00:00',
    note: 'Slight reduction — weight loss slowing',
    trainingCalories: 2250, trainingProtein: 185, trainingCarbs: 210, trainingFat: 62,
    restCalories: 1800, restProtein: 185, restCarbs: 125, restFat: 58,
  },
  {
    userId: JAKE, coachId: COACH,
    changedAt: '2026-04-24 08:00:00',
    note: 'Deload week — slight calorie increase to support recovery',
    trainingCalories: 2400, trainingProtein: 185, trainingCarbs: 240, trainingFat: 65,
    restCalories: 2100, restProtein: 185, restCarbs: 175, restFat: 62,
  },
  {
    userId: JAKE, coachId: COACH,
    changedAt: '2026-04-28 09:00:00',
    note: 'Post-deload — back to deficit, slightly lower than before',
    trainingCalories: 2200, trainingProtein: 190, trainingCarbs: 200, trainingFat: 60,
    restCalories: 1750, restProtein: 190, restCarbs: 110, restFat: 57,
  },
];

// Insert program logs
for (const log of programLogs) {
  await conn.execute(
    'INSERT INTO program_change_logs (userId, coachId, changes, note, changedAt) VALUES (?, ?, ?, ?, ?)',
    [log.userId, log.coachId, JSON.stringify(log.changes), log.note, log.changedAt]
  );
}
console.log(`Inserted ${programLogs.length} program change logs for Jake`);

// Insert cardio logs
for (const log of cardioLogs) {
  await conn.execute(
    'INSERT INTO cardio_change_logs (userId, coachId, changes, note, changedAt) VALUES (?, ?, ?, ?, ?)',
    [log.userId, log.coachId, JSON.stringify(log.changes), log.note, log.changedAt]
  );
}
console.log(`Inserted ${cardioLogs.length} cardio change logs for Jake`);

// Insert meal plan history (only if not duplicating the existing Apr 28 entry)
// Delete the existing one first to avoid duplicates
await conn.execute('DELETE FROM meal_plan_history WHERE userId = 1 AND id = 120001');
for (const log of mealLogs) {
  await conn.execute(
    `INSERT INTO meal_plan_history 
     (userId, coachId, trainingCalories, trainingProtein, trainingCarbs, trainingFat, restCalories, restProtein, restCarbs, restFat, note, changedAt) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [log.userId, log.coachId, log.trainingCalories, log.trainingProtein, log.trainingCarbs, log.trainingFat,
     log.restCalories, log.restProtein, log.restCarbs, log.restFat, log.note, log.changedAt]
  );
}
console.log(`Inserted ${mealLogs.length} meal plan history entries for Jake`);

await conn.end();
console.log('Done!');
