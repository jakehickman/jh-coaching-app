import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
const conn = await mysql.createConnection(url);

// Mapping: exercise name -> { old equipmentDetails value -> new machinePreset }
// "T&V H-Squat" entries get cleared (machinePreset stays null, equipmentDetails cleared)
const migrations = {
  "Leg Extension": { "T&V": "T&V Fitness Pin Loaded" },
  "Hack Squat": { "T&V": "T&V Fitness Plate Loaded" },
  "Straight Leg Machine Calf Raise": { "T&V H-Squat": null }, // clear only
};

// Fetch all of Jake's sessions
const [rows] = await conn.execute(`
  SELECT ws.id, ws.exercises
  FROM workout_sessions ws
  JOIN users u ON u.id = ws.userId
  WHERE u.name LIKE '%Jake%' OR u.email LIKE '%jake%'
`);

let updatedSessions = 0;
let updatedExercises = 0;

for (const row of rows) {
  const exs = typeof row.exercises === 'string' ? JSON.parse(row.exercises) : row.exercises;
  let changed = false;

  for (const ex of exs) {
    const mapping = migrations[ex.name];
    if (!mapping) continue;
    if (!ex.equipmentDetails || ex.machinePreset) continue;

    const newPreset = mapping[ex.equipmentDetails];
    if (newPreset === undefined) continue; // no mapping for this value

    if (newPreset !== null) {
      ex.machinePreset = newPreset;
    }
    ex.equipmentDetails = null;
    changed = true;
    updatedExercises++;
    console.log(`Session ${row.id}: ${ex.name} — equipmentDetails "${ex.equipmentDetails ?? 'cleared'}" → machinePreset "${newPreset ?? 'null'}"`);
  }

  if (changed) {
    await conn.execute(
      `UPDATE workout_sessions SET exercises = ? WHERE id = ?`,
      [JSON.stringify(exs), row.id]
    );
    updatedSessions++;
  }
}

console.log(`\nDone. Updated ${updatedExercises} exercises across ${updatedSessions} sessions.`);
await conn.end();
