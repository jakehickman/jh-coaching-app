import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
const conn = await mysql.createConnection(url);

const [rows] = await conn.execute(`
  SELECT ws.id, ws.sessionDate, ws.dayLabel, ws.exercises, u.name as userName, u.email
  FROM workout_sessions ws
  JOIN users u ON u.id = ws.userId
  ORDER BY ws.sessionDate DESC
`);

const legacy = [];
for (const row of rows) {
  const exs = typeof row.exercises === 'string' ? JSON.parse(row.exercises) : row.exercises;
  for (const ex of exs) {
    if (ex.equipmentDetails && ex.equipmentDetails.trim() !== '' && !ex.machinePreset) {
      legacy.push({
        user: row.userName,
        sessionId: row.id,
        date: row.sessionDate,
        day: row.dayLabel,
        exercise: ex.name,
        equipmentDetails: ex.equipmentDetails
      });
    }
  }
}

console.log(`Total legacy entries found: ${legacy.length}`);
console.log(JSON.stringify(legacy, null, 2));

await conn.end();
