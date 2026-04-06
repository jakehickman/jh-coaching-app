/**
 * Fifth-pass cleanup: milk, yogurt, broccoli, eggs, and remaining duplicates
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

// ─── Milk: keep whole, 2%, 1%, skim, buttermilk, evaporated, condensed, goat ─
const milkDelete = [
  'Milk (fat free and skim)',           // duplicate of skim
  'Milk (fat free or skim)',            // duplicate
  'Milk shakes, thick chocolate',       // processed drink
  'Milk, 1% fat, without added vitamin A and vitamin D',  // rename below
  'Milk, 2% milkfat, with added nonfat milk solids and vitamin A and vitamin D',
  'Milk, 2% milkfat, with added nonfat milk solids, without added vitamin A',
  'Milk, 2% milkfat, without added vitamin A and vitamin D',
  'Milk, 3.25% milkfat, without added vitamin A and vitamin D',
  'Milk, buttermilk, cultured',         // duplicate of buttermilk
  'Milk, buttermilk, dried',            // keep liquid
  'Milk, canned, evaporated and without added vitamin A',  // duplicate
  'Milk, chocolate, commercial',        // duplicate
  'Milk, chocolate, commercial, with added calcium',
  'Milk, chocolate, reduced sugar',
  'Milk, chocolate beverage, hot cocoa, homemade',
  'Milk, dry, without added vitamin D',
  'Milk, evaporated, 2% fat',           // keep full-fat evaporated
  'Milk, with added nonfat milk solids, vitamin A and vitamin D (fat free or skim)',
  'Milk, without added vitamin A and vitamin D (fat free or skim)',
];
for (const n of milkDelete) deleted += await deleteExact(n);

await rename('Milk, 2% milkfat', 'Milk, 2% fat');
await rename('Milk, 3.25% milkfat', 'Milk, whole');
await rename('Milk, canned, condensed, sweetened', 'Milk, condensed, sweetened');
await rename('Milk, canned, evaporated', 'Milk, evaporated');
await rename('Milk, chocolate', 'Milk, chocolate');
await rename('Milk, buttermilk', 'Buttermilk');

// ─── Yogurt: massive cleanup - keep only plain and a few generic flavoured ────
const yogurtDelete = [
  'Yogurt, Greek, 2% fat, apricot, CHOBANI',
  'Yogurt, Greek, 2% fat, key lime blend, CHOBANI',
  'Yogurt, Greek, 2% fat, mango, CHOBANI',
  'Yogurt, Greek, 2% fat, pineapple, CHOBANI',
  'Yogurt, Greek, 2% fat, strawberry banana, CHOBANI',
  'Yogurt, Greek, 2% fat,mixed berry blend, CHOBANI',
  'Yogurt, Greek, 2%fat, coconut blend, CHOBANI',
  'Yogurt, Greek, Blueberry, CHOBANI',
  'Yogurt, Greek, Fruit on Bottom, Blackberry, CHOBANI',
  'Yogurt, Greek, Fruit on Bottom, Pomegranate, CHOBANI',
  'Yogurt, Greek, Fruit on Bottom, Strawberry, CHOBANI',
  'Yogurt, Greek, fruit milk',
  'Yogurt, Greek, lemon blend, CHOBANI',
  'Yogurt, Greek, peach, CHOBANI',
  'Yogurt, Greek, plain milk',
  'Yogurt, Greek, plain, CHOBANI',
  'Yogurt, Greek, raspberry, CHOBANI',
  'Yogurt, Greek, strawberry',
  'Yogurt, Greek, strawberry, DANNON OIKOS',
  'Yogurt, Greek, vanilla, CHOBANI',
  'Yogurt, Greek, vanilla, DANNON OIKOS',
  'Yogurt, chocolate milk',
  'Yogurt, flavors not chocolate milk, with low-calorie sweetener',
  'Yogurt, flavors other than chocolate',
  'Yogurt, fruit variety',
  'Yogurt, fruit, low fat, 10 grams protein per 8 ounce',
  'Yogurt, fruit, low fat, 11g protein/8 oz',
  'Yogurt, fruit, low fat,9 g protein/8 oz',
  'Yogurt, fruit, with low calorie sweetener',
  'Yogurt, plain milk',
  'Yogurt, plain, skim milk',
  'Yogurt, vanilla flavor milk, sweetened with low calorie sweetener',
  'Yogurt, vanilla or lemon flavor milk, sweetened with low-calorie sweetener',
  'Yogurt, vanilla, low fat.',
];
for (const n of yogurtDelete) deleted += await deleteExact(n);

await rename('Yogurt, Greek, plain', 'Yogurt, Greek, plain');
await rename('Yogurt, Greek, vanilla', 'Yogurt, Greek, vanilla');
await rename('Yogurt, plain, low fat', 'Yogurt, plain, low fat');
await rename('Yogurt, vanilla', 'Yogurt, vanilla');
await rename('Yogurt, fruit, low fat', 'Yogurt, fruit, low fat');

// ─── Broccoli: keep only raw, delete sub-parts ────────────────────────────────
const broccoliDelete = [
  'Broccoli, flower clusters, raw',
  'Broccoli, leaves, raw',
  'Broccoli, stalks, raw',
];
for (const n of broccoliDelete) deleted += await deleteExact(n);

// ─── Potato: keep flesh+skin raw, delete skin-only ───────────────────────────
deleted += await deleteExact('Potato, raw, skin');
await rename('Potato, flesh and skin, raw', 'Potato, raw');

// ─── Carrot: keep raw, delete canned and juice ───────────────────────────────
deleted += await deleteExact('Carrot juice, canned');
deleted += await deleteExact('Carrot, canned');

// ─── Spinach: keep raw, delete canned ────────────────────────────────────────
deleted += await deleteExact('Spinach, canned');

// ─── Egg: delete quail egg ───────────────────────────────────────────────────
deleted += await deleteExact('Egg, quail, raw');

// ─── Eggplant: delete pickled ────────────────────────────────────────────────
deleted += await deleteExact('Eggplant, pickled');

// ─── Check what's left in a few categories ───────────────────────────────────
const [allFoods] = await conn.query("SELECT name FROM nutrition_foods ORDER BY name");
console.log('\nAll remaining foods:');
allFoods.forEach(r => console.log(' -', r.name));

const [[{ total }]] = await conn.query('SELECT COUNT(*) as total FROM nutrition_foods');
console.log(`\nDeleted this pass: ${deleted}`);
console.log(`Final count: ${total}`);

await conn.end();
