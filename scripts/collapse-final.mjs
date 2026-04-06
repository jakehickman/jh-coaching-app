/**
 * Final cleanup: oils, oranges, pineapple, raspberries, squash, salmon, soy protein, etc.
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

// ─── Oils: keep only the most common cooking oils ─────────────────────────────
// Keep: olive oil, coconut oil, vegetable/canola, sunflower, sesame, peanut, flaxseed, grapeseed
const oilsToDelete = [
  'Oil, coconut, confection fat, typical basis for ice cream coatings',
  'Oil, coconut, principal uses candy coatings, oil sprays, roasting nuts',
  'Oil, corn and canola',
  'Oil, corn and retail, all purpose salad or cooking',
  'Oil, corn, peanut, and olive',
  'Oil, flaxseed, contains added sliced flaxseed',
  'Oil, mid-oleic, sunflower',
  'Oil, palm',
  'Oil, palm and palm kernel, filling fat (non-hydrogenated)',
  'Oil, palm kernel (hydrogenated), confection fat, intermediate grade product',
  'Oil, palm kernel (hydrogenated), confection fat, uses similar to 95 degree hard butter',
  'Oil, palm kernel (hydrogenated), filling fat',
  'Oil, palm kernel (hydrogenated), used for whipped toppings, non-dairy',
  'Oil, palm kernel, confection fat, uses similar to high quality cocoa butter',
  'Oil, safflower, salad or cooking (primary safflower oil of commerce)',
  'Oil, safflower, salad or cooking, linoleic, (over 70%)',
  'Oil, soy (partially hydrogenated ), palm, principal uses icings and fillings',
  'Oil, soy (partially hydrogenated), principal uses popcorn and flavoring vegetables',
  'Oil, soybean lecithin',
  'Oil, soybean, salad or cooking',
  'Oil, soybean, salad or cooking, (partially hydrogenated)',
  'Oil, soybean, salad or cooking, (partially hydrogenated) and cottonseed',
  'Oil, sunflower (70% and over)',
  'Oil, sunflower, linoleic (less than 60%)',
  'Oil, sunflower, linoleic, (approx. 65%)',
  'Oil, sunflower, linoleic, (partially hydrogenated)',
  'Oil, vegetable, soybean, refined',
  'Vegetable oil, palm kernel',
  // Hydrogenated fats
  'Fat, beef tallow',
  'Fat, chicken',
  'Fat, duck',
  'Fat, goose',
  'Fat, turkey',
  'Shortening, household, lard and vegetable oil',
  'Shortening, household, soybean (partially hydrogenated)',
  'Shortening, household, soybean (partially hydrogenated) and palm',
  'Shortening, industrial, lard and vegetable oil',
  'Shortening, industrial, soybean (partially hydrogenated)',
  'Shortening, industrial, soybean (partially hydrogenated) and cottonseed',
  'Shortening, industrial, soybean (partially hydrogenated), pourable',
  'Shortening, multipurpose, soybean (partially hydrogenated) and palm',
  'Shortening, special purpose for baking, soybean (partially hydrogenated)',
  'Shortening, special purpose for bread and roll, soybean (partially hydrogenated)',
  'Shortening, special purpose for cakes and frosting, soybean (partially hydrogenated)',
];
for (const n of oilsToDelete) deleted += await deleteExact(n);

// Rename kept oils
await rename('Oil, olive, salad or cooking', 'Olive oil');
await rename('Oil, coconut', 'Coconut oil');
await rename('Oil, vegetable canola', 'Canola oil');
await rename('Oil, sunflower, linoleic', 'Sunflower oil');
await rename('Oil, sesame, salad or cooking', 'Sesame oil');
await rename('Oil, peanut, salad or cooking', 'Peanut oil');
await rename('Oil, flaxseed, cold pressed', 'Flaxseed oil');
await rename('Oil, grapeseed', 'Grapeseed oil');
await rename('Oil, corn', 'Corn oil');

// ─── Oranges: keep only one generic raw orange ───────────────────────────────
const orangesToDelete = [
  'Orange, raw, California, valencias',
  'Orange, raw, Florida',
  'Orange, raw, navels',
  'Orange, raw, with peel',
  'Orange peel, raw',
];
for (const n of orangesToDelete) deleted += await deleteExact(n);
await rename('Orange, raw', 'Orange, raw');

// ─── Pineapple: keep only one ────────────────────────────────────────────────
const pineappleToDelete = [
  'Pineapple, chunks, sweetened',
  'Pineapple, raw, extra sweet variety',
  'Pineapple, raw, traditional varieties',
];
for (const n of pineappleToDelete) deleted += await deleteExact(n);
await rename('Pineapple, raw, all varieties', 'Pineapple, raw');

// ─── Pear: keep only one ─────────────────────────────────────────────────────
deleted += await deleteExact('Pear, raw anjou');

// ─── Raspberry: keep only raw ────────────────────────────────────────────────
const raspberriesToDelete = [
  'Raspberry, puree, seedless',
  'Raspberry, puree, with seeds',
  'Raspberry, sweetened',
  'Raspberry, unsweetened',
];
for (const n of raspberriesToDelete) deleted += await deleteExact(n);
await rename('Raspberry, raw', 'Raspberries, raw');

// ─── Squash: keep only zucchini raw and winter squash raw ────────────────────
const squashToDelete = [
  'Squash, summer, all varieties, raw',
  'Squash, summer, crookneck and straightneck, canned, drained, solid, without salt',
  'Squash, summer, crookneck and straightneck, raw',
  'Squash, summer, scallop, raw',
  'Squash, summer, zucchini, italian style, canned',
  'Squash, winter, all varieties, raw',
  'Squash, zucchini, raw',
];
for (const n of squashToDelete) deleted += await deleteExact(n);
await rename('Squash, summer, zucchini, includes skin, raw', 'Zucchini, raw');
await rename('Squash, winter, raw', 'Squash, winter, raw');

// ─── Salmon: keep only raw and canned ────────────────────────────────────────
deleted += await deleteExact('Salmon, canned and bones');
deleted += await deleteExact('Salmon, canned, total can contents');

// ─── Soy protein: keep only isolate ─────────────────────────────────────────
const soyToDelete = [
  'Soy protein concentrate, produced by acid wash',
  'Soy protein concentrate, produced by alcohol extraction',
  'Soy protein isolate, potassium type',
  'Soybean, curd cheese',
];
for (const n of soyToDelete) deleted += await deleteExact(n);
await rename('Soy protein isolate', 'Soy protein isolate');

// ─── Peas: keep raw and canned (one each) ────────────────────────────────────
deleted += await deleteExact('Peas, canned, seasoned');

// ─── Peppers: keep raw and jalapeno raw ──────────────────────────────────────
const peppersToDelete = [
  'Peppers, canned',
  'Peppers, chili, canned',
  'Peppers, freeze-dried',
  'Peppers, hot chile',
  'Peppers, hot chili, canned, excluding seeds',
  'Peppers, hot chili, canned, pods, excluding seeds',
  'Peppers, hot pickled, canned',
  'Peppers, jalapeno, canned',
];
for (const n of peppersToDelete) deleted += await deleteExact(n);
await rename('Peppers, raw', 'Bell pepper, raw');
await rename('Peppers, hot chili, raw', 'Chili pepper, raw');
await rename('Peppers, jalapeno, raw', 'Jalapeno, raw');
await rename('Pepper, raw', 'Black pepper');

// ─── Olives: keep one ────────────────────────────────────────────────────────
deleted += await deleteExact('Olive, ripe, canned (jumbo-super colossal)');
await rename('Olive, pickled, canned or bottled', 'Olives');
await rename('Olive, ripe, canned (small-extra large)', 'Olives, black, canned');

// ─── Pickle relish: keep one ─────────────────────────────────────────────────
deleted += await deleteExact('Pickle relish, hamburger');
deleted += await deleteExact('Pickle relish, hot dog');
await rename('Pickle relish', 'Pickle relish');

// ─── Pumpkin: keep raw only ──────────────────────────────────────────────────
deleted += await deleteExact('Pumpkin, canned, with salt');
await rename('Pumpkin, canned, without salt', 'Pumpkin, canned');

// ─── Raisins: keep dark seedless only ────────────────────────────────────────
deleted += await deleteExact('Raisins, golden, seedless');
deleted += await deleteExact('Raisins, seeded');
await rename('Raisins, dark, seedless', 'Raisins');

// ─── Sour cream: keep regular only ───────────────────────────────────────────
deleted += await deleteExact('Sour cream, imitation, cultured');
deleted += await deleteExact('Sour cream, light');

// ─── Sandwich spread: delete ─────────────────────────────────────────────────
deleted += await deleteExact('Sandwich spread, meatless');
deleted += await deleteExact('Sandwich spread, with chopped pickle, regular, unspecified oils');

// ─── Sauerkraut: keep ────────────────────────────────────────────────────────
// (already just one)

// ─── Sausage, meatless: delete ───────────────────────────────────────────────
deleted += await deleteExact('Sausage, meatless');

// ─── Semolina: keep one ──────────────────────────────────────────────────────
deleted += await deleteExact('Semolina, un');

// ─── Rice: keep one ──────────────────────────────────────────────────────────
deleted += await deleteExact('Rice, long-grain, regular, raw, un');
await rename('Rice, long-grain, regular, raw', 'Rice, white, long-grain, raw');

// ─── Peach: keep raw only ────────────────────────────────────────────────────
deleted += await deleteExact('Peach, sweetened');

// ─── Parsley: keep raw only ──────────────────────────────────────────────────
deleted += await deleteExact('Parsley, freeze-dried');
deleted += await deleteExact('Parmesan cheese topping');

// ─── Shallots: keep raw only ─────────────────────────────────────────────────
deleted += await deleteExact('Shallots, freeze-dried');

// ─── Chives: keep raw only ───────────────────────────────────────────────────
// (already done in pass 5)

// ─── Onion: keep raw only ────────────────────────────────────────────────────
deleted += await deleteExact('Onion, young green, tops only');

// ─── Persimmons: keep japanese raw only ──────────────────────────────────────
deleted += await deleteExact('Persimmons, japanese, dried');
deleted += await deleteExact('Persimmons, native, raw');
await rename('Persimmons, japanese, raw', 'Persimmon, raw');

// ─── Vegetables mixed: keep one ──────────────────────────────────────────────
deleted += await deleteExact('Vegetables, mixed (corn, lima beans, peas beans, carrots) canned');
await rename('Vegetables, mixed, canned', 'Mixed vegetables, canned');

// ─── Succotash: delete ───────────────────────────────────────────────────────
deleted += await deleteExact('Succotash, (corn and limas), canned, with cream style corn');

// ─── Turnip greens: keep raw only ────────────────────────────────────────────
deleted += await deleteExact('Turnip greens, canned');

// ─── Tofu: rename to clean name ──────────────────────────────────────────────
// (already just one entry)

// ─── Beans: clean up ─────────────────────────────────────────────────────────
// Check what bean entries exist
const [beanRows] = await conn.query("SELECT name FROM nutrition_foods WHERE name LIKE '%bean%' OR name LIKE '%lentil%' ORDER BY name");
console.log('Bean entries:');
beanRows.forEach(r => console.log(' -', r.name));

const [[{ total }]] = await conn.query('SELECT COUNT(*) as total FROM nutrition_foods');
console.log(`\nDeleted this pass: ${deleted}`);
console.log(`Final count: ${total}`);

await conn.end();
