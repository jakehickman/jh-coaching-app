/**
 * Preview and delete daily_logs entries for Jake Hickman (userId matching
 * the user whose name = 'Jake Hickman') dated before 2026-04-06.
 *
 * Run with:  node scripts/delete-old-logs.mjs
 * Set DELETE=1 to actually delete:  DELETE=1 node scripts/delete-old-logs.mjs
 */

import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const conn = await mysql.createConnection(url);

// Find Jake Hickman's user id
const [users] = await conn.execute(
  "SELECT id, name, email FROM users WHERE name LIKE '%Jake Hickman%' OR email LIKE '%jakehickmna%' OR email LIKE '%jake%hickman%' LIMIT 5"
);
console.log("Matching users:", users);

if (!users.length) {
  console.error("No user found matching Jake Hickman");
  await conn.end();
  process.exit(1);
}

// Use first match
const user = users[0];
console.log(`\nUsing user: id=${user.id}, name=${user.name}, email=${user.email}`);

// Preview rows to be deleted
const cutoff = "2026-04-06";
const [rows] = await conn.execute(
  "SELECT id, logDate, weight, sleepHours FROM daily_logs WHERE userId = ? AND logDate < ? ORDER BY logDate",
  [user.id, cutoff]
);

console.log(`\nRows to delete (logDate < ${cutoff}): ${rows.length}`);
if (rows.length) {
  console.table(rows);
}

if (process.env.DELETE === "1") {
  const [result] = await conn.execute(
    "DELETE FROM daily_logs WHERE userId = ? AND logDate < ?",
    [user.id, cutoff]
  );
  console.log(`\nDeleted ${result.affectedRows} rows.`);
} else {
  console.log("\nDry run — set DELETE=1 to actually delete.");
}

await conn.end();
