import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
const conn = await mysql.createConnection(url);

const [rows] = await conn.execute(`
  SELECT ws.id, ws.sessionDate, ws.dayLabel, ws.exercises
  FROM workout_sessions ws
  JOIN users u ON u.id = ws.userId
  WHERE u.name LIKE '%Jake%' OR u.email LIKE '%jake%'
  ORDER BY ws.sessionDate DESC
  LIMIT 30
`);

// Find exercises with equipmentDetails but no machinePreset
const legacy = [];
for (const row of rows) {
  const exs = typeof row.exercises === 'string' ? JSON.parse(row.exercises) : row.exercises;
  for (const ex of exs) {
    if (ex.equipmentDetails && !ex.machinePreset) {
      legacy.push({ sessionId: row.id, date: row.sessionDate, day: row.dayLabel, exercise: ex.name, equipmentDetails: ex.equipmentDetails });
    }
  }
}

console.log('Legacy equipmentDetails (no machinePreset):');
console.log(JSON.stringify(legacy, null, 2));

await conn.end();
