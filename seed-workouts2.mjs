import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ── Training program days using only library exercises ────────────────────────
const days = [
  {
    name: 'A',
    focus: 'Chest & Triceps',
    exercises: [
      { name: 'Low Incline Smith Press', sets: '4', reps: '6-8', notes: 'Control the descent' },
      { name: 'Low Incline DB Press', sets: '3', reps: '8-10', notes: '' },
      { name: 'Flat Cable Fly', sets: '3', reps: '12-15', notes: 'Full stretch at bottom' },
      { name: 'Cable Pushdown', sets: '3', reps: '10-12', notes: '' },
      { name: 'Cable Overhead Extension', sets: '3', reps: '10-12', notes: '' },
    ],
  },
  {
    name: 'B',
    focus: 'Quads & Hamstrings',
    exercises: [
      { name: 'Hack Squat', sets: '4', reps: '6-8', notes: 'Depth to parallel' },
      { name: 'Leg Press - Mid Stance', sets: '3', reps: '10-12', notes: '' },
      { name: 'Leg Extension', sets: '3', reps: '12-15', notes: '' },
      { name: 'Lying Leg Curl', sets: '3', reps: '10-12', notes: 'Feel the hamstring stretch' },
      { name: 'Seated Leg Curl', sets: '3', reps: '10-12', notes: '' },
    ],
  },
  {
    name: 'C',
    focus: 'Back & Biceps',
    exercises: [
      { name: 'Barbell Row', sets: '4', reps: '6-8', notes: 'Drive elbows back' },
      { name: 'Neutral Cable Pulldown', sets: '3', reps: '8-10', notes: '' },
      { name: 'Neutral Seated Cable Row', sets: '3', reps: '10-12', notes: '' },
      { name: '1-Arm Cable Diagonal Pull', sets: '3', reps: '7-9', notes: '' },
      { name: 'EZ-Bar Curl', sets: '3', reps: '10-12', notes: '' },
    ],
  },
  {
    name: 'D',
    focus: 'Shoulders & Glutes',
    exercises: [
      { name: 'Machine Shoulder Press', sets: '4', reps: '8-10', notes: '' },
      { name: 'DB Lateral Raise', sets: '4', reps: '12-15', notes: '' },
      { name: '1-Arm Cable Lateral Raise', sets: '3', reps: '12-15', notes: '' },
      { name: 'Machine Hip Thrust', sets: '4', reps: '10-12', notes: 'Full hip extension at top' },
      { name: 'DB Split Squat', sets: '3', reps: '10 each', notes: '' },
    ],
  },
];

const [prog] = await conn.query('SELECT id FROM training_programs WHERE userId=1 LIMIT 1');
if (prog.length) {
  await conn.query('UPDATE training_programs SET days=? WHERE id=?', [JSON.stringify(days), prog[0].id]);
  console.log('Training program days updated.');
}

// ── Base weights for each exercise ────────────────────────────────────────────
const baseWeights = {
  'Low Incline Smith Press': 70,
  'Low Incline DB Press': 26,
  'Flat Cable Fly': 12,
  'Cable Pushdown': 32,
  'Cable Overhead Extension': 22,
  'Hack Squat': 80,
  'Leg Press - Mid Stance': 130,
  'Leg Extension': 50,
  'Lying Leg Curl': 40,
  'Seated Leg Curl': 40,
  'Barbell Row': 65,
  'Neutral Cable Pulldown': 52,
  'Neutral Seated Cable Row': 48,
  '1-Arm Cable Diagonal Pull': 14,
  'EZ-Bar Curl': 28,
  'Machine Shoulder Press': 50,
  'DB Lateral Raise': 10,
  '1-Arm Cable Lateral Raise': 8,
  'Machine Hip Thrust': 90,
  'DB Split Squat': 18,
};

// ── Insert 10 workout sessions over last 14 days ──────────────────────────────
const schedule = ['A', 'B', null, 'C', 'D', null];
await conn.query('DELETE FROM workout_sessions WHERE userId=1');

const now = new Date();
const sessions = [];

for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  const dayOfCycle = (14 - daysAgo) % 6;
  const dayLabel = schedule[dayOfCycle];
  if (!dayLabel) continue;

  const dayDef = days.find(d => d.name === dayLabel);
  if (!dayDef) continue;

  const sessionNum = sessions.length;
  const progressFactor = 1 + sessionNum * 0.01;

  const exercises = dayDef.exercises.map(ex => {
    const base = baseWeights[ex.name] ?? 20;
    const w1 = Math.round(base * progressFactor / 2.5) * 2.5;
    const w2 = Math.round(Math.max(w1 - 2.5, w1 * 0.95) / 2.5) * 2.5;
    const repsBase = parseInt(ex.reps.split('-')[0]) || 8;
    return {
      name: ex.name,
      sets: [
        { weight: w1, reps: repsBase + 1, notes: null },
        { weight: w2, reps: repsBase, notes: null },
        { weight: w2, reps: repsBase - 1, notes: null },
      ],
    };
  });

  const sessionDate = date.toISOString().slice(0, 10);
  sessions.push([1, sessionDate, dayLabel, JSON.stringify(exercises), new Date(), new Date()]);
}

if (sessions.length > 0) {
  await conn.query(
    'INSERT INTO workout_sessions (userId, sessionDate, dayLabel, exercises, createdAt, updatedAt) VALUES ?',
    [sessions]
  );
  console.log(`Inserted ${sessions.length} workout sessions.`);
}

await conn.end();
console.log('Done.');
