import { createConnection } from 'mysql2/promise';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = '/home/ubuntu/usda-data/sr_legacy/FoodData_Central_sr_legacy_food_csv_2018-04';

// Nutrient IDs we care about
const NUTRIENT_IDS = {
  calories: '1008',   // Energy (KCAL)
  protein: '1003',    // Protein
  fat: '1004',        // Total lipid (fat)
  carbs: '1005',      // Carbohydrate, by difference
  fiber: '1079',      // Fiber, total dietary
};

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

async function main() {
  console.log('Reading food.csv...');
  const foods = await readCSV(path.join(DATA_DIR, 'food.csv'));
  console.log(`  ${foods.length} foods loaded`);

  console.log('Reading food_nutrient.csv...');
  const foodNutrients = await readCSV(path.join(DATA_DIR, 'food_nutrient.csv'));
  console.log(`  ${foodNutrients.length} nutrient records loaded`);

  // Build nutrient lookup: fdcId -> { calories, protein, fat, carbs, fiber }
  console.log('Building nutrient map...');
  const nutrientMap = {};
  const targetIds = new Set(Object.values(NUTRIENT_IDS));
  for (const fn of foodNutrients) {
    if (!targetIds.has(fn.nutrient_id)) continue;
    if (!nutrientMap[fn.fdc_id]) nutrientMap[fn.fdc_id] = {};
    const amount = parseFloat(fn.amount) || 0;
    for (const [key, nid] of Object.entries(NUTRIENT_IDS)) {
      if (fn.nutrient_id === nid) nutrientMap[fn.fdc_id][key] = amount;
    }
  }
  console.log(`  Nutrient map built for ${Object.keys(nutrientMap).length} foods`);

  // Connect to DB
  const conn = await createConnection(process.env.DATABASE_URL);
  console.log('Connected to database');

  // Check existing count
  const [existing] = await conn.execute('SELECT COUNT(*) as cnt FROM nutrition_foods');
  console.log(`  Existing foods in DB: ${existing[0].cnt}`);

  // Get existing names to avoid duplicates
  const [existingNames] = await conn.execute('SELECT name FROM nutrition_foods');
  const existingSet = new Set(existingNames.map(r => r.name.toLowerCase()));

  // Prepare batch insert
  const toInsert = [];
  for (const food of foods) {
    const name = food.description;
    if (!name || name.length > 127) continue;
    if (existingSet.has(name.toLowerCase())) continue;
    const n = nutrientMap[food.fdc_id] || {};
    toInsert.push([
      name.substring(0, 127),
      Math.round((n.calories || 0) * 10) / 10,
      Math.round((n.protein || 0) * 100) / 100,
      Math.round((n.carbs || 0) * 100) / 100,
      Math.round((n.fiber || 0) * 100) / 100,
      Math.round((n.fat || 0) * 100) / 100,
      null, // servingUnit
      null, // servingGrams
    ]);
  }

  console.log(`  ${toInsert.length} new foods to insert`);

  // Insert in batches of 500
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    await conn.query(
      'INSERT INTO nutrition_foods (name, calories, protein, carbs, fiber, fat, servingUnit, servingGrams) VALUES ?',
      [batch]
    );
    inserted += batch.length;
    if (inserted % 2000 === 0 || inserted === toInsert.length) {
      console.log(`  Inserted ${inserted}/${toInsert.length}...`);
    }
  }

  const [final] = await conn.execute('SELECT COUNT(*) as cnt FROM nutrition_foods');
  console.log(`Done! Total foods in DB: ${final[0].cnt}`);
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
