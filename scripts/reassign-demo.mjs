import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Jake H demo user ID
const FROM_ID = 7;
// Coach (Jake Hickman) user ID
const TO_ID = 1;

console.log(`Reassigning all demo data from user ${FROM_ID} to user ${TO_ID}...`);

const tables = [
  "client_profiles",
  "daily_logs",
  "measurements",
  "meal_plans",
  "shopping_items",
  "training_programs",
  "meso_cycles",
  "timeline_milestones",
  "weekly_check_ins",
];

for (const table of tables) {
  // Check if user already has data in this table (avoid duplicates)
  const [existing] = await conn.execute(`SELECT COUNT(*) as cnt FROM ${table} WHERE userId = ?`, [TO_ID]);
  const count = existing[0].cnt;

  if (count > 0) {
    // Delete existing data for TO_ID first to avoid conflicts
    await conn.execute(`DELETE FROM ${table} WHERE userId = ?`, [TO_ID]);
    console.log(`  Cleared existing ${table} for user ${TO_ID}`);
  }

  // Reassign FROM_ID data to TO_ID
  const [result] = await conn.execute(`UPDATE ${table} SET userId = ? WHERE userId = ?`, [TO_ID, FROM_ID]);
  console.log(`  ${table}: ${result.affectedRows} rows reassigned`);
}

// Handle meso_sessions separately (linked via mesoId, not userId directly)
// First get the meso cycle IDs for TO_ID (just reassigned)
const [mesoRows] = await conn.execute(`SELECT id FROM meso_cycles WHERE userId = ?`, [TO_ID]);
if (mesoRows.length > 0) {
  const mesoIds = mesoRows.map(r => r.id);
  for (const mesoId of mesoIds) {
    const [r] = await conn.execute(`UPDATE meso_sessions SET userId = ? WHERE mesoId = ? AND userId = ?`, [TO_ID, mesoId, FROM_ID]);
    // Also update any that still have FROM_ID
    await conn.execute(`UPDATE meso_sessions SET userId = ? WHERE mesoId = ?`, [TO_ID, mesoId]);
  }
  console.log(`  meso_sessions: updated for ${mesoIds.length} cycles`);
}

// Also update coaching_notes clientId references
const [notesResult] = await conn.execute(`UPDATE coaching_notes SET clientId = ? WHERE clientId = ?`, [TO_ID, FROM_ID]);
console.log(`  coaching_notes: ${notesResult.affectedRows} rows updated`);

// Update coachId references in plans/programs
await conn.execute(`UPDATE meal_plans SET coachId = ? WHERE coachId = ?`, [TO_ID, FROM_ID]);
await conn.execute(`UPDATE training_programs SET coachId = ? WHERE coachId = ?`, [TO_ID, FROM_ID]);

// Update client_profiles coachId
await conn.execute(`UPDATE client_profiles SET coachId = ? WHERE coachId = ?`, [TO_ID, FROM_ID]);

console.log("\n✅ All demo data reassigned to user ID 1 (Jake Hickman)");
console.log("You can now log in and use 'View as Client' to see all populated tabs.");

await conn.end();
