/**
 * Backfill weightUnit='lbs' for Jake Hickman's workout sessions
 * where exercises have null/missing weightUnit.
 *
 * Run: node scripts/backfill-jake-weight-unit.mjs
 */
import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const db = await createConnection(process.env.DATABASE_URL);

// 1. Find Jake's user ID
const [users] = await db.execute(
  "SELECT id, name, email FROM users WHERE name LIKE '%Jake%' OR email LIKE '%jake%'"
);
console.log('Users found:', users);

if (!users.length) {
  console.error('No Jake user found. Exiting.');
  await db.end();
  process.exit(1);
}

// Use the first match (admin Jake)
const jake = users[0];
console.log(`\nUsing: id=${jake.id}, name=${jake.name}, email=${jake.email}`);

// 2. Get all workout sessions for Jake
const [sessions] = await db.execute(
  'SELECT id, sessionDate, exercises FROM workout_sessions WHERE userId = ?',
  [jake.id]
);
console.log(`\nFound ${sessions.length} workout sessions for Jake`);

if (!sessions.length) {
  console.log('No sessions to update. Exiting.');
  await db.end();
  process.exit(0);
}

// 3. For each session, update exercises that have null/missing weightUnit to 'lbs'
let updatedSessions = 0;
let updatedExercises = 0;

for (const session of sessions) {
  let exercises;
  try {
    exercises = typeof session.exercises === 'string'
      ? JSON.parse(session.exercises)
      : session.exercises;
  } catch {
    console.warn(`  Session ${session.id}: failed to parse exercises JSON, skipping`);
    continue;
  }

  if (!Array.isArray(exercises)) continue;

  let changed = false;
  for (const ex of exercises) {
    if (!ex.weightUnit) {
      ex.weightUnit = 'lbs';
      changed = true;
      updatedExercises++;
    }
  }

  if (changed) {
    await db.execute(
      'UPDATE workout_sessions SET exercises = ? WHERE id = ?',
      [JSON.stringify(exercises), session.id]
    );
    updatedSessions++;
    console.log(`  Updated session ${session.id} (${session.sessionDate})`);
  }
}

console.log(`\nDone. Updated ${updatedExercises} exercises across ${updatedSessions} sessions.`);
await db.end();
