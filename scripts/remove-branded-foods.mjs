import { createConnection } from 'mysql2/promise';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';

const DATA_DIR = '/home/ubuntu/usda-data/sr_legacy/FoodData_Central_sr_legacy_food_csv_2018-04';

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

async function readCSV(filePath) {
  const rows = [];
  const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
  let headers = null;
  for await (const line of rl) {
    const cols = parseCSVLine(line);
    if (!headers) { headers = cols; continue; }
    const obj = {};
    headers.forEach((h, i) => obj[h] = cols[i] ?? '');
    rows.push(obj);
  }
  return rows;
}

async function main() {
  console.log('Reading food.csv to find branded foods (category 26)...');
  const foods = await readCSV(path.join(DATA_DIR, 'food.csv'));
  
  const brandedNames = foods
    .filter(f => f.food_category_id === '26')
    .map(f => f.description.substring(0, 127));
  
  console.log(`Found ${brandedNames.length} branded food names to remove`);

  const conn = await createConnection(process.env.DATABASE_URL);
  
  const [before] = await conn.execute('SELECT COUNT(*) as cnt FROM nutrition_foods');
  console.log(`Foods before: ${before[0].cnt}`);

  // Delete in batches of 500
  const BATCH = 500;
  let deleted = 0;
  for (let i = 0; i < brandedNames.length; i += BATCH) {
    const batch = brandedNames.slice(i, i + BATCH);
    const placeholders = batch.map(() => '?').join(',');
    const [result] = await conn.execute(
      `DELETE FROM nutrition_foods WHERE name IN (${placeholders})`,
      batch
    );
    deleted += result.affectedRows;
    if (deleted % 2000 === 0 || i + BATCH >= brandedNames.length) {
      console.log(`  Deleted ${deleted} so far...`);
    }
  }

  const [after] = await conn.execute('SELECT COUNT(*) as cnt FROM nutrition_foods');
  console.log(`Foods after: ${after[0].cnt}`);
  console.log(`Done! Removed ${deleted} branded foods.`);
  
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
