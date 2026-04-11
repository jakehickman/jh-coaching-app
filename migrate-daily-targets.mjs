import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await mysql.createConnection(DB_URL);
try {
  // Check if column already exists
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'meal_plans' AND COLUMN_NAME = 'dailyTargets'`
  );
  if (rows.length > 0) {
    console.log("Column dailyTargets already exists — skipping.");
  } else {
    await conn.execute(`ALTER TABLE \`meal_plans\` ADD COLUMN \`dailyTargets\` JSON NULL AFTER \`meals\``);
    console.log("Column dailyTargets added to meal_plans.");
  }
} finally {
  await conn.end();
}
