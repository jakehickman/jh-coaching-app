import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);

// Find Jake Hickman
const [users] = await conn.execute(
  "SELECT id, name, email FROM users WHERE name LIKE ? OR name LIKE ?",
  ["%Jake%", "%Hickman%"]
);
console.log("Found users:", users);

if (users.length === 0) {
  console.log("No user found matching Jake Hickman");
  await conn.end();
  process.exit(0);
}

const userId = users[0].id;
console.log(`\nClearing all logged data for user: ${users[0].name} (id: ${userId})`);

// Tables to clear (logged/transactional data only — NOT profile/program/assignment tables)
const deletions = [
  { table: "daily_logs",           col: "userId" },
  { table: "measurements",         col: "userId" },
  { table: "workout_sessions",     col: "userId" },
  { table: "weekly_check_ins",     col: "userId" },
  { table: "check_in_submissions", col: "clientId" },
  { table: "timeline_milestones",  col: "userId" },
  { table: "coaching_notes",       col: "clientId" },
  { table: "onboarding_submissions", col: "userId" },
];

for (const { table, col } of deletions) {
  try {
    const [result] = await conn.execute(
      `DELETE FROM \`${table}\` WHERE \`${col}\` = ?`,
      [userId]
    );
    console.log(`  Deleted ${result.affectedRows} rows from ${table}`);
  } catch (e) {
    console.warn(`  Skipped ${table}: ${e.message}`);
  }
}

console.log("\nDone. Profile, meal plan, training program, and habit assignments were NOT touched.");
await conn.end();
