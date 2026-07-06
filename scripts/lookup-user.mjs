import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const db = await createConnection(process.env.DATABASE_URL);

const [rows] = await db.query(
  `SELECT u.id, u.name, u.email, u.loginMethod, u.role, u.approved, u.createdAt, u.lastSignedIn,
          cp.startDate, cp.displayName, cp.coachId
   FROM users u
   LEFT JOIN client_profiles cp ON cp.userId = u.id
   WHERE u.name LIKE '%David%' OR u.name LIKE '%Chen%' OR u.email LIKE '%david%' OR u.email LIKE '%chen%'`
);

for (const r of rows) {
  console.log(JSON.stringify(r, null, 2));
}

await db.end();
