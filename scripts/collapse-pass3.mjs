/**
 * Third-pass cleanup: tuna, pork, and other remaining duplicates
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function deleteExact(name) {
  const [r] = await conn.query('DELETE FROM nutrition_foods WHERE name = ?', [name]);
  return r.affectedRows;
}
async function rename(from, to) {
  const [r] = await conn.query('UPDATE nutrition_foods SET name = ? WHERE name = ?', [to, from]);
  return r.affectedRows;
}

let deleted = 0;

// ─── Tuna: keep only the most useful entries ──────────────────────────────────
// Keep: tuna canned in water, tuna canned in oil, tuna raw (one species)
// Delete: salted variants, tuna salad (processed), duplicate species
const tunaDelete = [
  'Fish, tuna, canned in oil, without salt',
  'Fish, tuna, canned in water, without salt',
  'Fish, tuna, light, canned in oil',
  'Fish, tuna, light, canned in oil, without salt',
  'Fish, tuna, light, canned in water, without salt',
  'Fish, tuna, bluefin, raw',
  'Fish, tuna, skipjack, raw',
  'Fish, tuna, yellowfin, raw',
  'Fish, tuna salad',
];
for (const n of tunaDelete) deleted += await deleteExact(n);
await rename('Fish, tuna, canned in water', 'Tuna, canned in water');
await rename('Fish, tuna, canned in oil', 'Tuna, canned in oil');
await rename('Fish, tuna, light, canned in water', 'Tuna, light, canned in water');

// ─── Pork: massive cleanup ────────────────────────────────────────────────────
// Keep: ground pork, pork loin, pork belly, pork shoulder, pork tenderloin,
//        pork ribs (spareribs), pork leg/ham, pork backribs, pork chops
// Delete: all the sub-cut/rump/shank/enhanced/water-added variants

const porkDelete = [
  // Ham variants - keep only one generic ham
  'Pork, cured, ham -- water added',
  'Pork, cured, ham -- water added, rump',
  'Pork, cured, ham -- water added, shank',
  'Pork, cured, ham and water product',
  'Pork, cured, ham and water product, rump',
  'Pork, cured, ham and water product, shank',
  'Pork, cured, ham with natural juices',
  'Pork, cured, ham with natural juices, rump',
  'Pork, cured, ham with natural juices, shank',
  'Pork, cured, ham with natural juices, spiral slice',
  'Pork, cured, ham, rump',
  'Pork, cured, ham, shank',
  // Leg variants - keep only one
  'Pork, leg (ham), rump half, raw',
  'Pork, leg (ham), shank half, raw',
  // Loin variants - keep only generic loin and tenderloin
  'Pork, loin (chops or roasts) only, raw',
  'Pork, loin (chops or roasts), raw',
  'Pork, loin (chops), raw',
  'Pork, loin, center rib (chops or roasts), raw',
  'Pork, loin ribs, raw',
  'Pork, enhanced, loin, tenderloin, raw',
  // Shoulder variants - keep only generic shoulder
  'Pork, shoulder, (Boston butt) (steaks), raw',
  'Pork, shoulder, arm picnic, raw',
  // Ground pork variants - keep only generic
  'Pork, ground, 84% lean / 16% fat, raw',
  'Pork, ground, 96% lean / 4% fat, raw',
  // Obscure cuts
  'Pork loin, backribs, raw, lean only',
  'Pork, Leg Cap Steak, raw',
  'Pork, Leg sirloin tip roast, raw',
  'Pork, Shoulder breast, raw',
  'Pork, Shoulder petite tender, raw',
  'Pork, cured, ham, center slice, raw',
];
for (const n of porkDelete) deleted += await deleteExact(n);

// Rename kept entries to cleaner names
await rename('Pork, loin, raw', 'Pork, loin, raw');
await rename('Pork, loin, tenderloin, raw', 'Pork, tenderloin, raw');
await rename('Pork, leg (ham), raw', 'Pork, leg (ham), raw');
await rename('Pork, cured, ham with natural juices', 'Pork, ham, cured');
await rename('Pork, ground, raw', 'Pork, ground, raw');
await rename('Pork, backribs, raw', 'Pork, back ribs, raw');

// ─── Check remaining fish entries ─────────────────────────────────────────────
const [fishRows] = await conn.query("SELECT name FROM nutrition_foods WHERE name LIKE 'Fish%' OR name LIKE '%cod%' OR name LIKE '%tilapia%' OR name LIKE '%halibut%' ORDER BY name");
console.log('Fish entries:');
fishRows.forEach(r => console.log(' -', r.name));

// Check dairy
const [dairyRows] = await conn.query("SELECT name FROM nutrition_foods WHERE name LIKE 'Milk%' OR name LIKE 'Cheese%' OR name LIKE 'Yogurt%' ORDER BY name LIMIT 30");
console.log('\nDairy entries (first 30):');
dairyRows.forEach(r => console.log(' -', r.name));

const [[{ total }]] = await conn.query('SELECT COUNT(*) as total FROM nutrition_foods');
console.log(`\nDeleted this pass: ${deleted}`);
console.log(`Final count: ${total}`);

await conn.end();
