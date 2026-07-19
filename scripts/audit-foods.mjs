import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const url = process.env.DATABASE_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }

// Parse mysql://user:pass@host:port/db?params
const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
if (!match) { console.error('Cannot parse DATABASE_URL'); process.exit(1); }
const [, user, password, host, port, database] = match;

const conn = await createConnection({ host, port: Number(port), user, password, database, ssl: { rejectUnauthorized: false } });

// Get all food names
const [rows] = await conn.query('SELECT id, name FROM nutrition_foods ORDER BY name');
await conn.end();

// Write to file for analysis
import { writeFileSync } from 'fs';
const names = rows.map(r => `${r.id}\t${r.name}`).join('\n');
writeFileSync('/tmp/food-names.txt', names);
console.log(`Total foods: ${rows.length}`);
console.log('Written to /tmp/food-names.txt');
