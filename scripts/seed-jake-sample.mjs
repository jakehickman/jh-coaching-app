/**
 * Seed 4 weeks of realistic sample data for Jake Hickman (userId=1)
 * Covers: daily_logs, measurements, workout_sessions, habit_completions, check_in_submissions
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const USER_ID = 1;
const HABIT_IDS = [1, 2]; // assigned habit IDs

// ── Helpers ──────────────────────────────────────────────────────────────────
function dateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function rand(min, max, dp = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dp));
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Update client profile with check-in day, step goal, start date ───────────
await conn.execute(
  `UPDATE client_profiles SET checkInDay='monday', stepGoal=10000, startDate=? WHERE userId=?`,
  [dateStr(28), USER_ID]
);
console.log('✓ Updated client profile');

// ── Daily logs (28 days) ─────────────────────────────────────────────────────
// Schedule: A, B, Off, C, D, Off (repeating)
const schedule = ['A', 'B', null, 'C', 'D', null];
const trainingTypes = { A: 'A', B: 'B', C: 'C', D: 'D' };

// Weight trend: starts ~90kg, slowly decreasing ~0.2kg/week
let weight = 90.2;
const weightDecayPerDay = 0.2 / 7;

// Delete existing logs for Jake to avoid duplicates
await conn.execute('DELETE FROM daily_logs WHERE userId=?', [USER_ID]);
await conn.execute('DELETE FROM measurements WHERE userId=?', [USER_ID]);
await conn.execute('DELETE FROM workout_sessions WHERE userId=?', [USER_ID]);
await conn.execute('DELETE FROM habit_completions WHERE clientId=?', [USER_ID]);
await conn.execute('DELETE FROM check_in_submissions WHERE clientId=?', [USER_ID]);
console.log('✓ Cleared existing data');

const logIds = [];
for (let daysAgo = 28; daysAgo >= 0; daysAgo--) {
  const iso = dateStr(daysAgo);
  const scheduleIdx = (28 - daysAgo) % schedule.length;
  const sessionType = schedule[scheduleIdx];
  const isTraining = sessionType !== null;

  weight -= weightDecayPerDay;
  const w = parseFloat((weight + rand(-0.3, 0.3)).toFixed(1));

  // Skip a few days randomly (no log = non-adherent)
  if (Math.random() < 0.08 && daysAgo > 0) continue;

  // Off-plan meals: mostly 0, occasionally 1-2
  const offPlanMeals = Math.random() < 0.2 ? (Math.random() < 0.4 ? 2 : 1) : 0;

  const [res] = await conn.execute(
    `INSERT INTO daily_logs
      (userId, logDate, weight, sleepHours, sleepQuality, caffeineServings,
       trainingCompleted, trainingType, stepsCount, offPlanMeals, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      USER_ID,
      iso,
      w,
      parseFloat(rand(6.5, 8.5).toFixed(1)),
      Math.floor(rand(2, 5)),
      Math.floor(rand(0, 3)),
      isTraining ? 1 : 0,
      isTraining ? sessionType : null,
      Math.floor(rand(7000, 14000, 0)),
      offPlanMeals,
      daysAgo === 0 ? 'Feeling good today, energy was high.' : null,
    ]
  );
  logIds.push({ id: res.insertId, iso, isTraining, sessionType });
}
console.log(`✓ Inserted ${logIds.length} daily logs`);

// ── Workout sessions (training days only) ────────────────────────────────────
// Exercise sets per session day
const sessionExercises = {
  A: [
    { name: 'Flat Smith Press', sets: [{weight:100,reps:8},{weight:100,reps:7},{weight:97.5,reps:9}] },
    { name: 'Low Incline DB Press', sets: [{weight:34,reps:10},{weight:34,reps:9}] },
    { name: 'Machine Fly', sets: [{weight:60,reps:12},{weight:60,reps:11}] },
    { name: 'Cable Pushdown', sets: [{weight:42.5,reps:12},{weight:42.5,reps:11}] },
    { name: '1-Arm Cable Lateral Raise', sets: [{weight:12.5,reps:15},{weight:12.5,reps:14}] },
  ],
  B: [
    { name: 'Neutral Cable Pulldown', sets: [{weight:72.5,reps:10},{weight:72.5,reps:9},{weight:70,reps:10}] },
    { name: 'Overhand Machine Row', sets: [{weight:80,reps:10},{weight:80,reps:9}] },
    { name: 'Alternating DB Curl', sets: [{weight:18,reps:12},{weight:18,reps:11}] },
    { name: 'EZ-Bar Curl', sets: [{weight:35,reps:10},{weight:35,reps:9}] },
  ],
  C: [
    { name: 'Leg Press - Low Stance', sets: [{weight:200,reps:10},{weight:200,reps:9},{weight:190,reps:11}] },
    { name: 'Machine Sissy Squat', sets: [{weight:50,reps:12},{weight:50,reps:11}] },
    { name: 'Seated Leg Curl', sets: [{weight:60,reps:12},{weight:60,reps:11}] },
    { name: 'Barbell SLDL', sets: [{weight:90,reps:10},{weight:90,reps:9}] },
    { name: 'Bent Leg Machine Calf Raise', sets: [{weight:80,reps:15},{weight:80,reps:14}] },
  ],
  D: [
    { name: 'Smith JM Press', sets: [{weight:60,reps:10},{weight:60,reps:9}] },
    { name: 'Machine Chest Press', sets: [{weight:75,reps:10},{weight:75,reps:9}] },
    { name: 'Overhand Cable Pulldown', sets: [{weight:70,reps:10},{weight:70,reps:9}] },
    { name: 'Neutral Seated Cable Row', sets: [{weight:65,reps:10},{weight:65,reps:9}] },
    { name: 'DB Hammer Curl', sets: [{weight:20,reps:12},{weight:20,reps:11}] },
  ],
};

// Small progressive overload: add ~2.5kg every 7 days
let wsCount = 0;
for (const log of logIds) {
  if (!log.isTraining || !log.sessionType) continue;
  const weekOffset = Math.floor((28 - parseInt(log.iso.slice(-2))) / 7);
  const overload = weekOffset * 2.5;
  const exs = sessionExercises[log.sessionType] ?? [];
  const exercisesWithSets = exs.map(ex => ({
    name: ex.name,
    sets: ex.sets.map(s => ({
      weight: parseFloat((s.weight + overload + rand(-1.25, 1.25)).toFixed(1)),
      reps: s.reps + (Math.random() < 0.3 ? 1 : 0),
      completed: true,
    })),
  }));

  await conn.execute(
    `INSERT INTO workout_sessions (userId, sessionDate, dayLabel, exercises, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [USER_ID, log.iso, log.sessionType, JSON.stringify(exercisesWithSets), null]
  );
  wsCount++;
}
console.log(`✓ Inserted ${wsCount} workout sessions`);

// ── Measurements (once per week, Mondays) ────────────────────────────────────
// Waist decreasing ~0.5cm/week, skinfolds decreasing ~0.5mm/week
const measDays = [28, 21, 14, 7, 0];
let waist = 84.5;
let umb = 12.0;
let sup = 9.5;

for (const daysAgo of measDays) {
  const iso = dateStr(daysAgo);
  const w = parseFloat((waist + rand(-0.3, 0.3)).toFixed(1));
  const u1 = parseFloat((umb + rand(-0.5, 0.5)).toFixed(1));
  const u2 = parseFloat((umb + rand(-0.5, 0.5)).toFixed(1));
  const u3 = parseFloat((umb + rand(-0.5, 0.5)).toFixed(1));
  const u4 = parseFloat((umb + rand(-0.5, 0.5)).toFixed(1));
  const u5 = parseFloat((umb + rand(-0.5, 0.5)).toFixed(1));
  const s1 = parseFloat((sup + rand(-0.3, 0.3)).toFixed(1));
  const s2 = parseFloat((sup + rand(-0.3, 0.3)).toFixed(1));
  const s3 = parseFloat((sup + rand(-0.3, 0.3)).toFixed(1));
  const s4 = parseFloat((sup + rand(-0.3, 0.3)).toFixed(1));
  const s5 = parseFloat((sup + rand(-0.3, 0.3)).toFixed(1));

  await conn.execute(
    `INSERT INTO measurements
      (userId, measureDate, waist,
       umbilical1, umbilical2, umbilical3, umbilical4, umbilical5,
       suprailiac1, suprailiac2, suprailiac3, suprailiac4, suprailiac5)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [USER_ID, iso, w, u1, u2, u3, u4, u5, s1, s2, s3, s4, s5]
  );

  waist -= 0.5;
  umb -= 0.5;
  sup -= 0.3;
}
console.log('✓ Inserted 5 measurement sessions');

// ── Habit completions ────────────────────────────────────────────────────────
let hcCount = 0;
for (const log of logIds) {
  for (const habitId of HABIT_IDS) {
    // ~85% completion rate
    if (Math.random() < 0.85) {
      await conn.execute(
        `INSERT IGNORE INTO habit_completions (clientId, habitId, completedDate) VALUES (?, ?, ?)`,
        [USER_ID, habitId, log.iso]
      );
      hcCount++;
    }
  }
}
console.log(`✓ Inserted ${hcCount} habit completions`);

// ── Check-in submissions (3 weeks of check-ins) ──────────────────────────────
const checkIns = [
  {
    weekStartDate: dateStr(21),
    dietAdherence: 'mostly',
    dietAdherenceReason: 'Had a work dinner on Wednesday that threw me off plan, but kept it reasonable.',
    wentWell: 'All 4 training sessions completed. Sleep was solid all week averaging 7.5 hours.',
    challenges: 'Eating enough protein on rest days was tricky. Social eating situations.',
    wins: 'Hit a new PB on leg press — 200kg for 10 reps.',
    overallFeeling: 4,
    coachReply: 'Great week Jake. The leg press PB is a big one. For the social eating situations, try pre-eating a protein source before the event so you\'re not as hungry when you arrive.',
  },
  {
    weekStartDate: dateStr(14),
    dietAdherence: 'fully',
    dietAdherenceReason: null,
    wentWell: 'Perfect diet adherence. Energy levels were high all week. Training felt strong.',
    challenges: 'Slight knee discomfort on leg day — backed off the weight slightly on sissy squat.',
    wins: 'Waist measurement down another 0.5cm. Weight dropped 0.4kg this week.',
    overallFeeling: 5,
    coachReply: 'Best week yet. The consistency is showing in the numbers. Keep monitoring the knee — if it persists we\'ll swap sissy squat for a hack squat variation.',
  },
  {
    weekStartDate: dateStr(7),
    dietAdherence: 'mostly',
    dietAdherenceReason: 'Had one off-plan meal on Saturday night — birthday dinner.',
    wentWell: 'Training was great. Strength is up across the board.',
    challenges: 'Fatigue hit mid-week. Took an extra rest day on Thursday.',
    wins: 'Down 0.8kg from last week. Feeling leaner.',
    overallFeeling: 4,
    coachReply: null, // coach hasn't replied yet
  },
];

for (const ci of checkIns) {
  await conn.execute(
    `INSERT INTO check_in_submissions
      (clientId, coachId, weekStartDate, dietAdherence, dietAdherenceReason,
       wentWell, challenges, wins, overallFeeling, coachReply, coachRepliedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      USER_ID, USER_ID, ci.weekStartDate, ci.dietAdherence, ci.dietAdherenceReason ?? null,
      ci.wentWell, ci.challenges, ci.wins, ci.overallFeeling,
      ci.coachReply ?? null,
      ci.coachReply ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
    ]
  );
}
console.log('✓ Inserted 3 check-in submissions');

await conn.end();
console.log('\n🎉 Seed complete!');
