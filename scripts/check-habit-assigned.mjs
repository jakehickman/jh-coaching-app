import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  `SELECT ha.id, ha.habitId, ha.clientId, ha.assignedAt, h.name
   FROM habit_assignments ha
   JOIN habits h ON h.id = ha.habitId
   LIMIT 10`
);
console.log("Habit assignments:");
rows.forEach(r => {
  console.log(`  id=${r.id} habit="${r.name}" assignedAt=${r.assignedAt} (type: ${typeof r.assignedAt})`);
});
await conn.end();
