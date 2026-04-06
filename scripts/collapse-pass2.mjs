/**
 * Second-pass cleanup:
 * 1. Collapse ground beef fat% variants → keep 80/20 (most common)
 * 2. Collapse salmon variants → keep "Fish, salmon, raw" + "Fish, salmon, canned"
 * 3. Remove redundant sub-cut beef entries (knuckle tip center/side, etc.)
 * 4. General: for any group sharing the same base name with only numeric/fat% suffix, keep one
 * 5. Remove foods that are clearly processed/junk or duplicates of simpler entries
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Helper: delete by name pattern
async function deleteWhere(pattern) {
  const [result] = await conn.query('DELETE FROM nutrition_foods WHERE name LIKE ?', [pattern]);
  return result.affectedRows;
}

// Helper: delete by exact name
async function deleteExact(name) {
  const [result] = await conn.query('DELETE FROM nutrition_foods WHERE name = ?', [name]);
  return result.affectedRows;
}

// Helper: rename
async function rename(from, to) {
  const [result] = await conn.query('UPDATE nutrition_foods SET name = ? WHERE name = ?', [to, from]);
  return result.affectedRows;
}

let deleted = 0;

// ─── Ground beef: keep only 80/20 and 93/7 (lean), remove the rest ───────────
const groundBeefToDelete = [
  'Beef, ground, 70% lean meat / 30% fat, raw',
  'Beef, ground, 75% lean meat / 25% fat, raw',
  'Beef, ground, 85% lean meat / 15% fat, raw',
  'Beef, ground, 90% lean meat / 10% fat, raw',
  'Beef, ground, 95% lean meat / 5% fat, raw',
  'Beef, ground, 97% lean meat / 3% fat, raw',
];
for (const n of groundBeefToDelete) {
  deleted += await deleteExact(n);
}
// Rename the kept ones to cleaner names
await rename('Beef, ground, 80% lean meat / 20% fat, raw', 'Beef, ground (80/20), raw');
await rename('Beef, ground, 93% lean meat / 7% fat, raw', 'Beef, ground (93/7 lean), raw');

// ─── Salmon: keep raw and canned (one each), delete duplicates ────────────────
deleted += await deleteExact('Fish, salmon, canned, total can contents');
deleted += await deleteExact('Fish, salmon, canned, without salt');
await rename('Fish, salmon, canned', 'Salmon, canned');
await rename('Fish, salmon, raw', 'Salmon, raw');

// ─── Beef sub-cuts that are too specific ─────────────────────────────────────
const beefSubcutsToDelete = [
  'Beef, round, knuckle, tip center, steak, raw',
  'Beef, round, knuckle, tip side, steak, raw',
  'Beef, sandwich steaks, flaked, formed and thinly sliced, raw',
  'Beef, loin petite roast/filet, raw',
  'Beef, ribeye petite roast/filet, raw',
];
for (const n of beefSubcutsToDelete) {
  deleted += await deleteExact(n);
}

// ─── Rename remaining beef to cleaner names ───────────────────────────────────
await rename('Beef steak, raw', 'Beef, steak, raw');
await rename('Beef, loin, tenderloin roast, raw', 'Beef, tenderloin, raw');
await rename('Beef, loin, tenderloin steak, raw', 'Beef, tenderloin steak, raw');
await rename('Beef, rib eye steak, lip off, raw', 'Beef, rib eye steak, raw');
await rename('Beef, rib, shortribs, raw', 'Beef, short ribs, raw');
await rename('Beef, ribeye cap steak, raw', 'Beef, ribeye, raw');

// ─── Check for remaining near-duplicates in common foods ─────────────────────
// Tuna
const [tunaRows] = await conn.query("SELECT id, name FROM nutrition_foods WHERE name LIKE '%tuna%' ORDER BY name");
console.log('Tuna entries:');
tunaRows.forEach(r => console.log(' -', r.name));

// Chicken
const [chickenRows] = await conn.query("SELECT id, name FROM nutrition_foods WHERE name LIKE 'Chicken%' ORDER BY name");
console.log('Chicken entries:');
chickenRows.forEach(r => console.log(' -', r.name));

// Pork
const [porkRows] = await conn.query("SELECT id, name FROM nutrition_foods WHERE name LIKE 'Pork%' ORDER BY name");
console.log('Pork entries:');
porkRows.forEach(r => console.log(' -', r.name));

// Rice
const [riceRows] = await conn.query("SELECT id, name FROM nutrition_foods WHERE name LIKE '%rice%' ORDER BY name");
console.log('Rice entries:');
riceRows.forEach(r => console.log(' -', r.name));

// Bread
const [breadRows] = await conn.query("SELECT id, name FROM nutrition_foods WHERE name LIKE 'Bread%' ORDER BY name");
console.log('Bread entries:');
breadRows.forEach(r => console.log(' -', r.name));

const [[{ total }]] = await conn.query('SELECT COUNT(*) as total FROM nutrition_foods');
console.log(`\nDeleted this pass: ${deleted}`);
console.log(`Final count: ${total}`);

await conn.end();
