/**
 * Add low-fat / non-fat variants for key dairy foods where the fat level
 * matters for product selection (e.g. Greek yogurt, cottage cheese, sour cream, ricotta).
 * Macros sourced from USDA FoodData Central per 100g.
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function upsert(name, cal, protein, carbs, fiber, fat, servingUnit = null, servingGrams = null) {
  const [existing] = await conn.query('SELECT id FROM nutrition_foods WHERE name = ?', [name]);
  if (existing.length > 0) {
    console.log(`  SKIP (already exists): ${name}`);
    return;
  }
  await conn.query(
    'INSERT INTO nutrition_foods (name, calories, protein, carbs, fiber, fat, servingUnit, servingGrams) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [name, cal, protein, carbs, fiber, fat, servingUnit, servingGrams]
  );
  console.log(`  + ${name} | cal:${cal} pro:${protein} fat:${fat}`);
}

// ─── Greek Yogurt ────────────────────────────────────────────────────────────
// Already have: Yogurt, Greek, plain (0% fat ~59 cal, 10.2g pro, 0.4g fat)
// Add full-fat and low-fat variants
console.log('\n=== Greek Yogurt ===');
await upsert('Yogurt, Greek, plain, low fat (2%)',  73,  9.95, 3.98, 0,  2.0);
await upsert('Yogurt, Greek, plain, full fat (5%)', 97,  9.0,  3.98, 0,  5.0);

// ─── Regular Yogurt ──────────────────────────────────────────────────────────
// Already have: Yogurt, plain, low fat (63 cal) and Yogurt, vanilla (78 cal)
console.log('\n=== Regular Yogurt ===');
await upsert('Yogurt, plain, non-fat',  56, 5.73, 7.68, 0, 0.18);
await upsert('Yogurt, plain, whole milk', 61, 3.47, 4.66, 0, 3.25);

// ─── Cottage Cheese ──────────────────────────────────────────────────────────
// Already have: Cottage cheese (full fat ~98 cal, 4.3g fat)
console.log('\n=== Cottage Cheese ===');
await upsert('Cottage cheese, low fat (1%)', 72, 12.39, 2.72, 0, 1.02);
await upsert('Cottage cheese, non-fat',      72, 10.34, 6.15, 0, 0.29);

// ─── Sour Cream ──────────────────────────────────────────────────────────────
// Already have: Sour cream (full fat 181 cal, 14.1g fat)
console.log('\n=== Sour Cream ===');
await upsert('Sour cream, light', 136, 3.44, 6.63, 0, 10.6, 'tbsp', 12);
await upsert('Sour cream, non-fat', 74,  3.44, 14.1, 0, 0.0,  'tbsp', 12);

// ─── Ricotta ─────────────────────────────────────────────────────────────────
// Already have: Cheese, ricotta milk (full fat 150 cal, 10.2g fat)
console.log('\n=== Ricotta ===');
await upsert('Ricotta, part-skim', 138, 11.39, 5.14, 0, 7.91);
await upsert('Ricotta, non-fat',    74, 10.34, 6.15, 0, 0.29);

// ─── Milk ────────────────────────────────────────────────────────────────────
// Already have: Milk, whole (61 cal) and Milk, 2% fat (56 cal)
console.log('\n=== Milk ===');
await upsert('Milk, 1% fat',  42, 3.57, 5.0, 0, 0.97);
await upsert('Milk, skim (non-fat)', 34, 3.37, 4.96, 0, 0.08);

// ─── Cream cheese ────────────────────────────────────────────────────────────
console.log('\n=== Cream Cheese ===');
await upsert('Cream cheese',          342, 5.93, 4.07, 0, 34.24, 'tbsp', 14);
await upsert('Cream cheese, light',   145, 7.5,  5.5,  0, 11.0,  'tbsp', 14);
await upsert('Cream cheese, non-fat',  90, 13.0, 7.0,  0,  0.0,  'tbsp', 14);

// ─── Mozzarella ──────────────────────────────────────────────────────────────
// Already have: Mozzarella (full fat, slice) and Mozzarella, part-skim (slice)
// Part-skim is already there — that's the common low-fat variant, good.

const [[{ total }]] = await conn.query('SELECT COUNT(*) as total FROM nutrition_foods');
console.log(`\nTotal foods now: ${total}`);

await conn.end();
