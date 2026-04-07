import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

const sql = readFileSync('./drizzle/0008_checkin_form_redesign.sql', 'utf8');
const stmts = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

const conn = await mysql.createConnection(process.env.DATABASE_URL);
for (const stmt of stmts) {
  try {
    await conn.execute(stmt);
    console.log('OK:', stmt.slice(0, 70));
  } catch (e) {
    console.log('ERR:', e.message.slice(0, 100));
  }
}
await conn.end();
console.log('Migration complete.');
