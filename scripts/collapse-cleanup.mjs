/**
 * Final cleanup: remove remaining junk/exotic/duplicate items
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

// ─── Ice cream: remove all variants ─────────────────────────────────────────
const iceCreams = [
  'Ice cream bar, stick or nugget, with crunch coating',
  'Ice cream cone, chocolate covered, with nuts, flavors other than chocolate',
  'Ice cream cookie sandwich',
  'Ice cream sandwich',
  'Ice cream sandwich, made with light ice cream, vanilla',
  'Ice cream sandwich, vanilla, light, no sugar added',
  'Ice cream sundae cone',
  'Ice cream, bar or stick, chocolate covered',
  'Ice cream, light, soft serve, chocolate',
  'Ice cream, no sugar added, cone, added peanuts and chocolate sauce',
  'Ice cream, soft serve, chocolate',
  'Light ice cream, Creamsicle',
];
for (const n of iceCreams) deleted += await deleteExact(n);

// ─── Exotic/obscure items ────────────────────────────────────────────────────
const exotic = [
  'Imitation cheese, american or cheddar, low cholesterol',
  'Jackfruit, canned, syrup pack',
  'Jackfruit, raw',
  'Java-plum, (jambolan), raw',
  'Jellyfish, dried',
  'Jerusalem-artichokes, raw',
  "Jew's ear, (pepeao), raw",
  'Juice, apple and pear blend and calcium',
  'Jujube, Chinese, dried',
  'Jujube, raw',
  'Jute, potherb, raw',
  'Kanpyo, (dried gourd strips)',
  'Kiwifruit, ZESPRI SunGold, raw',
  'Kumquats, raw',
  'Lemon grass (citronella), raw',
  'Lemon peel, raw',
  'Litchis, dried',
  'Litchis, raw',
  'Longans, dried',
  'Longans, raw',
  'Mango, dried, sweetened',
  'Melons, casaba, raw',
  'Mollusks, eastern, canned',
  'Mollusks, eastern, raw',
  'Mollusks, mussel, blue, raw',
  'Mollusks, octopus, common, raw',
  'Mollusks, raw',
  'Mollusks, scallop, imitation, made from surimi',
];
for (const n of exotic) deleted += await deleteExact(n);

// ─── Kefir: keep plain only, remove branded ──────────────────────────────────
deleted += await deleteExact('Kefir, strawberry, LIFEWAY');
await rename('Kefir, plain, LIFEWAY', 'Kefir, plain');

// ─── Lemon: keep raw juice only ──────────────────────────────────────────────
deleted += await deleteExact('Lemon juice from concentrate, bottled');
deleted += await deleteExact('Lemon juice from concentrate, bottled, REAL LEMON');
deleted += await deleteExact('Lemon juice from concentrate, canned or bottled');
await rename('Lemon juice, raw', 'Lemon juice');
await rename('Lemon, raw, without peel', 'Lemon, raw');

// ─── Lentils: keep one ───────────────────────────────────────────────────────
deleted += await deleteExact('Lentils or red, raw');

// ─── Lime: keep raw only ─────────────────────────────────────────────────────
deleted += await deleteExact('Lime juice, canned or bottled, unsweetened');
await rename('Lime juice, raw', 'Lime juice');

// ─── Mayonnaise: keep regular only ───────────────────────────────────────────
deleted += await deleteExact('Mayonnaise dressing, no cholesterol');
deleted += await deleteExact('Mayonnaise, low sodium, low calorie or diet');
deleted += await deleteExact('Mayonnaise, made with tofu');
deleted += await deleteExact('Mayonnaise, with olive oil');

// ─── Melons: keep cantaloupe and honeydew only ────────────────────────────────
// (casaba already deleted above)

// ─── Canola oil: keep one ────────────────────────────────────────────────────
deleted += await deleteExact('Oil, canola (partially hydrogenated) oil for deep fat frying');
deleted += await deleteExact('Oil, canola for salads, woks and light frying');
deleted += await deleteExact('Oil, canola with antifoaming agent, principal uses salads, woks and light frying');
deleted += await deleteExact('Oil, coconut (hydrogenated), used for whipped toppings and coffee whiteners');
await rename('Oil, canola', 'Canola oil');

// ─── Avocado oil: rename ─────────────────────────────────────────────────────
await rename('Oil, avocado', 'Avocado oil');

// ─── Nuts: clean up ──────────────────────────────────────────────────────────
deleted += await deleteExact('Nut, almond paste');
deleted += await deleteExact('Nut, formulated, wheat-based, all flavors except macadamia, without salt');
deleted += await deleteExact('Nut, pine nuts, pinyon, dried');
deleted += await deleteExact('Nut, walnuts, glazed');
await rename('Nut, almonds', 'Almonds');
await rename('Nut, almond butter, plain, with salt added', 'Almond butter, salted');
await rename('Nut, almond butter, plain, without salt added', 'Almond butter, unsalted');
await rename('Nut, brazilnuts, dried', 'Brazil nuts');
await rename('Nut, cashew butter, plain, with salt added', 'Cashew butter, salted');
await rename('Nut, cashew butter, plain, without salt added', 'Cashew butter, unsalted');
await rename('Nut, cashew nuts, raw', 'Cashews, raw');
await rename('Nut, hazelnuts or filberts', 'Hazelnuts');
await rename('Nut, macadamia nuts, raw', 'Macadamia nuts');
await rename('Nut, pecans', 'Pecans');
await rename('Nut, pine nuts, dried', 'Pine nuts');
await rename('Nut, pistachio nuts, raw', 'Pistachios, raw');
await rename('Nut, walnuts, black, dried', 'Walnuts, black');
await rename('Nut, walnuts, english', 'Walnuts');

// ─── Lamb: keep only ground and leg ──────────────────────────────────────────
const lambToDelete = [
  'Lamb zealand, rib, raw',
  'Lamb, cubed for stew or kabob (leg and shoulder), raw',
  'Lamb, foreshank, raw',
  'Lamb, leg half, raw',
  'Lamb, leg, shank half, raw',
  'Lamb, loin, raw',
  'Lamb, rib, raw',
  'Lamb, shoulder (arm and blade), raw',
  'Lamb, shoulder, arm, raw',
];
for (const n of lambToDelete) deleted += await deleteExact(n);
await rename('Lamb, ground, raw', 'Lamb, ground, raw');
await rename('Lamb, leg (shank and sirloin), raw', 'Lamb, leg, raw');
await rename('Lamb, shoulder, raw', 'Lamb, shoulder, raw');

// ─── Mollusks: keep scallop and squid ────────────────────────────────────────
await rename('Mollusks, scallop, raw', 'Scallops, raw');
await rename('Mollusks, squid, raw', 'Squid, raw');

// ─── Cucumber: keep one ──────────────────────────────────────────────────────
deleted += await deleteExact('Cucumber, peeled, raw');
await rename('Cucumber, with peel, raw', 'Cucumber, raw');

// ─── Mushroom: keep raw only ─────────────────────────────────────────────────
deleted += await deleteExact('Mushroom, exposed to ultraviolet light, raw');

// ─── Turkey: remove back and neck (not commonly used) ────────────────────────
deleted += await deleteExact('Turkey, back, raw');
deleted += await deleteExact('Turkey, neck, raw');
deleted += await deleteExact('Turkey, raw');  // keep specific cuts
deleted += await deleteExact('Turkey, ground, raw');  // keep the fat% versions

// ─── Beef: remove shoulder cuts ──────────────────────────────────────────────
deleted += await deleteExact('Beef, shoulder pot roast or steak, raw');
deleted += await deleteExact('Beef, shoulder top blade steak, raw');

// ─── Chicken: remove back and canned no broth ────────────────────────────────
deleted += await deleteExact('Chicken, back, raw');
deleted += await deleteExact('Chicken, canned, no broth');

// ─── Pork: remove back ribs (less common than spareribs) ─────────────────────
deleted += await deleteExact('Pork, back ribs, raw');

// ─── Beans: add missing common ones, check what's there ─────────────────────
const [beanRows] = await conn.query("SELECT name FROM nutrition_foods WHERE name LIKE '%bean%' OR name LIKE '%lentil%' OR name LIKE '%chickpea%' OR name LIKE '%pea%' ORDER BY name");
console.log('Legume entries:');
beanRows.forEach(r => console.log(' -', r.name));

const [[{ total }]] = await conn.query('SELECT COUNT(*) as total FROM nutrition_foods');
console.log(`\nDeleted this pass: ${deleted}`);
console.log(`Final count: ${total}`);

// Final full list
const [allFoods] = await conn.query("SELECT name FROM nutrition_foods ORDER BY name");
console.log('\nFinal food list:');
allFoods.forEach(r => console.log(r.name));

await conn.end();
