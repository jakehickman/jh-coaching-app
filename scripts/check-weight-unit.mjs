/**
 * Check weightUnit values in Jake's workout sessions
 */
import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const db = await createConnection(process.env.DATABASE_URL);

// Get Jake's sessions
const [sessions] = await db.query(
  'SELECT id, sessionDate, exercises FROM workout_sessions WHERE userId=1 ORDER BY sessionDate DESC LIMIT 5'
);

console.log(`Found ${sessions.length} sessions\n`);

for (const session of sessions) {
  const exercises = typeof session.exercises === 'string'
    ? JSON.parse(session.exercises)
    : session.exercises;
  
  console.log(`Session ${session.id} (${session.sessionDate}):`);
  for (const ex of exercises.slice(0, 2)) {
    console.log(`  Exercise: "${ex.name}" | weightUnit: ${JSON.stringify(ex.weightUnit)} | keys: ${Object.keys(ex).join(', ')}`);
  }
  console.log('');
}

await db.end();
