import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }

const conn = await createConnection(url);
try {
  await conn.execute("ALTER TABLE check_in_submissions ADD COLUMN reviewedAt TIMESTAMP NULL AFTER focusNextWeek");
  console.log("Added reviewedAt");
} catch(e) { console.log("reviewedAt:", e.message); }
try {
  await conn.execute("ALTER TABLE check_in_submissions DROP COLUMN coachReply");
  console.log("Dropped coachReply");
} catch(e) { console.log("coachReply:", e.message); }
try {
  await conn.execute("ALTER TABLE check_in_submissions DROP COLUMN coachRepliedAt");
  console.log("Dropped coachRepliedAt");
} catch(e) { console.log("coachRepliedAt:", e.message); }
await conn.end();
