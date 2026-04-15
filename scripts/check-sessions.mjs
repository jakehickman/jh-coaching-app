import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load env
import { config } from 'dotenv';
config();

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// Raw query for simplicity
const [sessions] = await connection.execute(
  `SELECT ws.id, ws.user_id, ws.session_date, ws.day_label, ws.updated_at, u.name, u.email
   FROM workout_sessions ws
   JOIN users u ON u.id = ws.user_id
   WHERE ws.session_date = '2026-04-15'
   ORDER BY ws.updated_at DESC`
);

console.log('Sessions on Apr 15:', JSON.stringify(sessions, null, 2));

const [allSessions] = await connection.execute(
  `SELECT ws.id, ws.user_id, ws.session_date, ws.day_label, ws.updated_at, u.name
   FROM workout_sessions ws
   JOIN users u ON u.id = ws.user_id
   WHERE u.name = 'Jake Hickman'
   ORDER BY ws.session_date DESC
   LIMIT 10`
);

console.log('Jake recent sessions:', JSON.stringify(allSessions, null, 2));

await connection.end();
