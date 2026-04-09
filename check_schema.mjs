import { createConnection } from 'mysql2/promise';
const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute("DESCRIBE check_in_submissions");
console.log(rows.map(r => r.Field + ' ' + r.Type).join('\n'));
await conn.end();
