import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  await conn.execute("ALTER TABLE `daily_logs` RENAME COLUMN `caffeineIntake` TO `caffeineServings`");
  console.log("✓ Renamed caffeineIntake → caffeineServings");
} catch (e) {
  if (e.code === "ER_BAD_FIELD_ERROR" || e.message.includes("caffeineIntake")) {
    console.log("⚠ caffeineIntake already renamed, skipping");
  } else throw e;
}

try {
  await conn.execute("ALTER TABLE `daily_logs` MODIFY COLUMN `caffeineServings` float");
  console.log("✓ Modified caffeineServings to float");
} catch (e) { console.error("modify float:", e.message); }

try {
  await conn.execute("ALTER TABLE `daily_logs` ADD `sleepQuality` int");
  console.log("✓ Added sleepQuality column");
} catch (e) {
  if (e.message.includes("Duplicate column")) {
    console.log("⚠ sleepQuality already exists, skipping");
  } else throw e;
}

try {
  await conn.execute("ALTER TABLE `daily_logs` DROP COLUMN `energyLevel`");
  console.log("✓ Dropped energyLevel");
} catch (e) {
  if (e.message.includes("check that column/key exists")) {
    console.log("⚠ energyLevel already dropped, skipping");
  } else throw e;
}

try {
  await conn.execute("ALTER TABLE `daily_logs` DROP COLUMN `stressLevel`");
  console.log("✓ Dropped stressLevel");
} catch (e) {
  if (e.message.includes("check that column/key exists")) {
    console.log("⚠ stressLevel already dropped, skipping");
  } else throw e;
}

await conn.end();
console.log("Migration complete.");
