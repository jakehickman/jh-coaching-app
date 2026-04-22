import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const db = await createConnection(process.env.DATABASE_URL);

const clientId = 1200026; // Sam Hickman

console.log("=== Step 1: client_profiles ===");
const [profiles] = await db.query("SELECT * FROM client_profiles WHERE user_id = ?", [clientId]);
console.log("profiles:", JSON.stringify(profiles, null, 2));

if (profiles.length === 0) {
  console.log("NO PROFILE FOUND - this is the bug");
  await db.end();
  process.exit(0);
}

const profile = profiles[0];
console.log("checkInDay:", profile.check_in_day);
console.log("startDate:", profile.start_date);
console.log("stepGoal:", profile.step_goal);

console.log("\n=== Step 2: daily_logs ===");
const [logs] = await db.query("SELECT * FROM daily_logs WHERE user_id = ? ORDER BY log_date DESC LIMIT 5", [clientId]);
console.log("log count:", logs.length);
if (logs.length > 0) {
  console.log("first log keys:", Object.keys(logs[0]));
  console.log("first log:", JSON.stringify(logs[0], null, 2));
}

console.log("\n=== Step 3: measurements ===");
const [meas] = await db.query("SELECT * FROM measurements WHERE user_id = ? ORDER BY date DESC LIMIT 3", [clientId]);
console.log("meas count:", meas.length);
if (meas.length > 0) {
  console.log("first meas keys:", Object.keys(meas[0]));
  console.log("first meas:", JSON.stringify(meas[0], null, 2));
}

console.log("\n=== Step 4: workout_sessions ===");
const [sessions] = await db.query("SELECT * FROM workout_sessions WHERE user_id = ? ORDER BY date DESC LIMIT 3", [clientId]);
console.log("sessions count:", sessions.length);
if (sessions.length > 0) {
  console.log("first session keys:", Object.keys(sessions[0]));
}

console.log("\n=== Step 5: habit_completions ===");
const [completions] = await db.query("SELECT * FROM habit_completions WHERE user_id = ? ORDER BY completed_at DESC LIMIT 3", [clientId]);
console.log("completions count:", completions.length);
if (completions.length > 0) {
  console.log("first completion keys:", Object.keys(completions[0]));
  console.log("first completion:", JSON.stringify(completions[0], null, 2));
}

console.log("\n=== Step 6: training_programs ===");
const [programs] = await db.query("SELECT id, name, is_active FROM training_programs WHERE user_id = ?", [clientId]);
console.log("programs:", JSON.stringify(programs));

console.log("\n=== ALL DONE ===");
await db.end();
