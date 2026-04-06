import { createConnection } from 'mysql2/promise';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';

const DATA_DIR = '/home/ubuntu/usda-data/sr_legacy/FoodData_Central_sr_legacy_food_csv_2018-04';

// Categories to KEEP (whole foods only)
const KEEP_CATEGORIES = new Set([
  '1',  // Dairy and Egg Products
  '4',  // Fats and Oils
  '5',  // Poultry Products
  '9',  // Fruits and Fruit Juices
  '10', // Pork Products
  '11', // Vegetables and Vegetable Products
  '12', // Nut and Seed Products
  '13', // Beef Products
  '15', // Finfish and Shellfish Products
  '16', // Legumes and Legume Products
  '17', // Lamb, Veal, and Game Products
  '20', // Cereal Grains and Pasta
]);

// Categories to REMOVE:
// 2 - Spices and Herbs (borderline, but keeping for meal plans)
// 3 - Baby Foods
// 6 - Soups, Sauces, and Gravies
// 7 - Sausages and Luncheon Meats
// 8 - Breakfast Cereals (often branded)
// 14 - Beverages
// 18 - Baked Products (heavily branded)
// 19 - Sweets
// 21 - Fast Foods
// 22 - Meals, Entrees, and Side Dishes
// 23 - Snacks
// 24 - American Indian/Alaska Native Foods
// 25 - Restaurant Foods
// 26 - Branded Food Products Database
// 27 - Quality Control Materials
// 28 - Alcoholic Beverages

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
  console.log('Reading food.csv...');
  const foods = await readCSV(path.join(DATA_DIR, 'food.csv'));

  // Names to REMOVE = foods NOT in keep categories
  const toRemove = foods
    .filter(f => !KEEP_CATEGORIES.has(f.food_category_id))
    .map(f => f.description.substring(0, 127));

  const toKeep = foods.filter(f => KEEP_CATEGORIES.has(f.food_category_id));

  console.log(`Foods to remove: ${toRemove.length}`);
  console.log(`Foods to keep: ${toKeep.length}`);

  const conn = await createConnection(process.env.DATABASE_URL);
  const [before] = await conn.execute('SELECT COUNT(*) as cnt FROM nutrition_foods');
  console.log(`DB before: ${before[0].cnt}`);

  // Delete in batches of 500
  const BATCH = 500;
  let deleted = 0;
  for (let i = 0; i < toRemove.length; i += BATCH) {
    const batch = toRemove.slice(i, i + BATCH);
    const placeholders = batch.map(() => '?').join(',');
    const [result] = await conn.execute(
      `DELETE FROM nutrition_foods WHERE name IN (${placeholders})`,
      batch
    );
    deleted += result.affectedRows;
  }

  const [after] = await conn.execute('SELECT COUNT(*) as cnt FROM nutrition_foods');
  console.log(`DB after: ${after[0].cnt}`);
  console.log(`Removed: ${deleted} foods`);

  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
