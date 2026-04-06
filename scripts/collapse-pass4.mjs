/**
 * Fourth-pass cleanup: fish, dairy, and remaining duplicates
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function deleteExact(name) {
  const [r] = await conn.query('DELETE FROM nutrition_foods WHERE name = ?', [name]);
  return r.affectedRows;
}
async function rename(from, to) {
  await conn.query('UPDATE nutrition_foods SET name = ? WHERE name = ?', [to, from]);
}

let deleted = 0;

// ─── Fish cleanup ─────────────────────────────────────────────────────────────
const fishDelete = [
  'Fish, Salmon, canned and bones',  // duplicate of Salmon, canned
  'Fish, anchovy, european, raw',    // keep canned (more common use)
  'Fish, bass water, raw',           // obscure
  'Fish, catfish, channel, raw',     // rename to simpler
  'Fish, cod, canned, solids and liquid',  // keep raw
  'Fish, cod, dried and salted',     // keep raw
  'Fish, cod, raw (may have been previously frozen)',  // duplicate
  'Fish, halibut, Greenland, raw',   // keep generic halibut
  'Fish, herring, kippered',         // keep raw
  'Fish, herring, pickled',          // keep raw
  'Fish, lingcod, raw',              // obscure
  'Fish, mackerel and jack, raw',    // duplicate
  'Fish, mackerel, jack, canned',    // keep raw mackerel
  'Fish, mackerel, spanish, raw',    // keep generic mackerel
  'Fish, milkfish, raw',             // obscure
  'Fish, pollock, Alaska, raw (may contain additives to retain moisture)',  // duplicate
  'Fish, pollock, raw',              // keep Alaska pollock
  'Fish, sardine, canned in tomato sauce',  // keep oil version
  'Fish, seatrout, raw',             // obscure
  'Fish, trout, brook, raw York State',  // keep generic trout
  'Fish, trout, rainbow, raw',       // keep generic trout
];
for (const n of fishDelete) deleted += await deleteExact(n);

// Rename fish to cleaner names
await rename('Fish, anchovy, european, canned in oil', 'Anchovies, canned in oil');
await rename('Fish, bass, striped, raw', 'Bass, raw');
await rename('Fish, catfish, channel, raw', 'Catfish, raw');
await rename('Fish, cod, raw', 'Cod, raw');
await rename('Fish, haddock, raw', 'Haddock, raw');
await rename('Fish, halibut and Pacific, raw', 'Halibut, raw');
await rename('Fish, herring, raw', 'Herring, raw');
await rename('Fish, mackerel, raw', 'Mackerel, raw');
await rename('Fish, pollock, Alaska, raw', 'Pollock, raw');
await rename('Fish, sardine, canned in oil', 'Sardines, canned in oil');
await rename('Fish, sea bass, raw', 'Sea bass, raw');
await rename('Fish, snapper, raw', 'Snapper, raw');
await rename('Fish, swordfish, raw', 'Swordfish, raw');
await rename('Fish, tilapia, raw', 'Tilapia, raw');
await rename('Fish, trout, raw', 'Trout, raw');
await rename('Fish, whiting, raw', 'Whiting, raw');

// ─── Dairy cleanup ────────────────────────────────────────────────────────────
const dairyDelete = [
  'Cheese food, pasteurized process, swiss',
  'Cheese spread, American or Cheddar cheese base',
  'Cheese spread, cream cheese base',
  'Cheese substitute, mozzarella',
  'Cheese, Swiss or fat free',
  'Cheese, american cheddar, imitation',
  'Cheese, cheddar or fat free',
  'Cheese, cheddar, sharp',
  'Cheese, colby',
  'Cheese, cottage, creamed, with fruit',
  'Cheese, cottage, uncreamed, dry, large or small curd',
  'Cheese, low fat, cheddar or colby',
  'Cheese, low-sodium, cheddar or colby',
  'Cheese, monterey, low fat',
  'Cheese, mozzarella milk',
  'Cheese, mozzarella, part-skim, shredded',
  'Cheese, parmesan, dry grated',
  'Cheese, parmesan, grated',
  'Cheese, parmesan, hard',
];
for (const n of dairyDelete) deleted += await deleteExact(n);

// Rename dairy to cleaner names
await rename('Cheese, cottage, creamed, large or small curd', 'Cottage cheese');
await rename('Cheese, mozzarella, part-skim', 'Mozzarella, part-skim');
await rename('Cheese, parmesan', 'Parmesan');
await rename('Cheese, cheddar', 'Cheddar');
await rename('Cheese, feta', 'Feta');
await rename('Cheese, gouda', 'Gouda');
await rename('Cheese, brie', 'Brie');
await rename('Cheese, camembert', 'Camembert');
await rename('Cheese, blue', 'Blue cheese');
await rename('Cheese, monterey', 'Monterey Jack');
await rename('Cheese, mozzarella', 'Mozzarella');

// ─── Check milk entries ───────────────────────────────────────────────────────
const [milkRows] = await conn.query("SELECT name FROM nutrition_foods WHERE name LIKE 'Milk%' ORDER BY name");
console.log('Milk entries:');
milkRows.forEach(r => console.log(' -', r.name));

// Check yogurt
const [yogurtRows] = await conn.query("SELECT name FROM nutrition_foods WHERE name LIKE 'Yogurt%' ORDER BY name");
console.log('\nYogurt entries:');
yogurtRows.forEach(r => console.log(' -', r.name));

// Check eggs
const [eggRows] = await conn.query("SELECT name FROM nutrition_foods WHERE name LIKE 'Egg%' ORDER BY name");
console.log('\nEgg entries:');
eggRows.forEach(r => console.log(' -', r.name));

// Check vegetables
const [vegRows] = await conn.query("SELECT name FROM nutrition_foods WHERE name LIKE 'Broccoli%' OR name LIKE 'Spinach%' OR name LIKE 'Carrot%' OR name LIKE 'Potato%' ORDER BY name");
console.log('\nVeg entries (sample):');
vegRows.forEach(r => console.log(' -', r.name));

const [[{ total }]] = await conn.query('SELECT COUNT(*) as total FROM nutrition_foods');
console.log(`\nDeleted this pass: ${deleted}`);
console.log(`Final count: ${total}`);

await conn.end();
