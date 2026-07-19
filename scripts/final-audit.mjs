import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const url = process.env.DATABASE_URL;
const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
const [, user, password, host, port, database] = match;

const conn = await createConnection({ host, port: Number(port), user, password, database, ssl: { rejectUnauthorized: false } });

const [rows] = await conn.query('SELECT id, name FROM nutrition_foods ORDER BY name');
await conn.end();

const names = rows.map(r => `${r.id}\t${r.name}`).join('\n');
writeFileSync('/tmp/food-names-after.txt', names);
console.log(`Remaining foods: ${rows.length}`);

// Spot check for any remaining branded items that slipped through
// Look for items with known brand indicators
const suspicious = rows.filter(r => {
  const n = r.name;
  return (
    // ALL CAPS words that are likely brands (3+ chars, not common abbreviations)
    /\b[A-Z]{3,}\b/.test(n) && !/\b(USA|FDA|USDA|NFS|UPC|RTE|MRE|NS|NFY|NFE|NFS|NFD|NFS)\b/.test(n)
  );
});

console.log(`\nItems with ALL-CAPS words (potential brands): ${suspicious.length}`);
suspicious.slice(0, 50).forEach(r => console.log(`  ${r.id}\t${r.name}`));
