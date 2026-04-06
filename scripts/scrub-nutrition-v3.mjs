import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ─── STEP 1: Delete cooked/prepared entries ───────────────────────────────────
// Keywords that indicate a cooked or prepared form
const cookedKeywords = [
  'roasted', 'stewed', 'heated', 'fried', 'baked', 'boiled', 'grilled',
  'broiled', 'microwaved', 'steamed', 'sauteed', 'poached', 'smoked',
  'rotisserie', 'BBQ', 'braised', 'cooked', 'prepared', 'pan-fried',
  'deep-fried', 'toasted', 'dehydrated', 'reconstituted',
];

// Build a WHERE clause for cooked keywords
const cookedConditions = cookedKeywords.map(k => `LOWER(name) LIKE '%${k.toLowerCase()}%'`).join(' OR ');

const [[{ cookedCount }]] = await conn.query(
  `SELECT COUNT(*) as cookedCount FROM nutrition_foods WHERE ${cookedConditions}`
);
console.log(`Cooked/prepared entries to delete: ${cookedCount}`);

await conn.query(`DELETE FROM nutrition_foods WHERE ${cookedConditions}`);
console.log('Deleted cooked/prepared entries.');

// ─── STEP 2: Delete highly specific / irrelevant variants ─────────────────────
const specificPatterns = [
  '%Wagyu%',
  '%marble score%',
  '%New Zealand%',
  '%Australian%',
  '%grass-fed%',
  '%giblets%',
  '%capons%',
  '%cornish game hens%',
  '%dark meat%',
  '%light meat%',
  '%composite of trimmed%',
  '%lip-on%',
  '%rib eye steak/roast%',
  '%brisket flat half%',
  '%brisket navel%',
  '%brisket point%',
  '%chuck eye roll%',
  '%cube roll%',
  '%bolar blade%',
  '%seam fat%',
  '%external fat%',
  '%back ribs%',
  '%under blade%',
  '%Denver Cut%',
  '%porterhouse%',
  '%inside skirt%',
  '%outside skirt%',
  '%tip round%',
  '%sirloin cap%',
  '%mock tender%',
  '%arm pot roast%',
  '%eye of round%',
  '%top round%',
  '%bottom round%',
  '%top loin%',
  '%small end%',
  '%large end%',
  '%ribs 10-12%',
  '%ribs 6-9%',
  '%ribs 2-5%',
  '%ribs 9-11%',
  '%ribs 11-12%',
  '%ribs 6-12%',
  '%plate steak%',
  '%flank steak%',
  '%short loin%',
  '%broiler or fryers%',
  '%broiler or fryer%',
  '%and giblets%',
  '%and neck%',
  '%capons%',
  '%cornish%',
  '%game hens%',
  '%Abiyuch%',
  '%Acerola%',
  '%Alfalfa seeds%',
  '%Amaranth leaves%',
  '%Arrowhead%',
  '%Balsam-pear%',
  '%Baobab%',
  '%Barley malt%',
  '%adzuki%',
  '%black turtle%',
  '%cranberry (roman)%',
  '%fava, in pod%',
  '%french, raw%',
  '%great northern%',
  '%kidney, california red%',
  '%kidney, all types%',
  '%Bacon bits, meatless%',
  '%Bacon, meatless%',
  '%Animal fat%',
  '%with added ascorbic acid%',
  '%without added ascorbic acid%',
  '%undiluted%',
  '%frozen concentrate%',
  '%sweetened, sliced, drained%',
  '%dehydrated%',
  '%stewed, with added sugar%',
  '%stewed, without added sugar%',
  '%frozen, unsweetened%',
  '%frozen, sweetened%',
  '%extra heavy syrup%',
  '%extra light syrup%',
  '%heavy syrup, drained%',
  '%light syrup pack%',
  '%water pack%',
  '%juice pack%',
  '%heavy syrup pack%',
  '%sweetened, with salt%',
  '%sweetened, without salt%',
  '%without added ascorbic%',
  '%with added vitamin%',
  '%protein fortified%',
  '%fortified%',
  '%nectar%',
  '%powder%',
  '%flour%',
  '%meal%',
  '%hulled%',
  '%pearled%',
  '%sprouted%',
  '%Arrowroot%',
  '%Barley flour%',
  '%Barley, hulled%',
  '%Barley, pearled%',
  '%Bamboo shoots%',
  '%Baobab%',
];

for (const pattern of specificPatterns) {
  const [[{ cnt }]] = await conn.query(
    `SELECT COUNT(*) as cnt FROM nutrition_foods WHERE name LIKE ?`, [pattern]
  );
  if (cnt > 0) {
    await conn.query(`DELETE FROM nutrition_foods WHERE name LIKE ?`, [pattern]);
    console.log(`Deleted ${cnt} entries matching: ${pattern}`);
  }
}

// ─── STEP 3: Delete exact duplicates (keep lowest ID) ─────────────────────────
const [[{ dupCount }]] = await conn.query(`
  SELECT COUNT(*) as dupCount FROM nutrition_foods nf
  WHERE id NOT IN (
    SELECT MIN(id) FROM nutrition_foods GROUP BY name
  )
`);
console.log(`Exact duplicates to remove: ${dupCount}`);

await conn.query(`
  DELETE FROM nutrition_foods
  WHERE id NOT IN (
    SELECT * FROM (SELECT MIN(id) FROM nutrition_foods GROUP BY name) t
  )
`);
console.log('Removed exact duplicates.');

// ─── STEP 4: Simplify names ────────────────────────────────────────────────────
const [allFoods] = await conn.query('SELECT id, name FROM nutrition_foods');
console.log(`\nSimplifying ${allFoods.length} remaining entries...`);

let simplified = 0;

for (const food of allFoods) {
  let name = food.name;

  // Plurals → singular for common foods
  name = name
    .replace(/^Apples,/, 'Apple,')
    .replace(/^Apricots,/, 'Apricot,')
    .replace(/^Bananas,/, 'Banana,')
    .replace(/^Oranges,/, 'Orange,')
    .replace(/^Peaches,/, 'Peach,')
    .replace(/^Pears,/, 'Pear,')
    .replace(/^Plums,/, 'Plum,')
    .replace(/^Grapes,/, 'Grape,')
    .replace(/^Strawberries,/, 'Strawberry,')
    .replace(/^Blueberries,/, 'Blueberry,')
    .replace(/^Raspberries,/, 'Raspberry,')
    .replace(/^Blackberries,/, 'Blackberry,')
    .replace(/^Cherries,/, 'Cherry,')
    .replace(/^Mangos,/, 'Mango,')
    .replace(/^Avocados,/, 'Avocado,')
    .replace(/^Tomatoes,/, 'Tomato,')
    .replace(/^Potatoes,/, 'Potato,')
    .replace(/^Carrots,/, 'Carrot,')
    .replace(/^Onions,/, 'Onion,')
    .replace(/^Lemons,/, 'Lemon,')
    .replace(/^Limes,/, 'Lime,')
    .replace(/^Dates,/, 'Date,')
    .replace(/^Figs,/, 'Fig,')
    .replace(/^Olives,/, 'Olive,')
    .replace(/^Mushrooms,/, 'Mushroom,')
    .replace(/^Beans,/, 'Beans,') // keep plural for beans
    .replace(/^Nuts,/, 'Nut,')
    .replace(/^Seeds,/, 'Seed,');

  // Remove trailing ", raw" if it's the only qualifier left (make it implicit)
  // Actually keep "raw" for clarity since we're a raw-weights app

  // Remove redundant qualifiers
  name = name
    .replace(/,\s*with skin$/i, '')
    .replace(/,\s*without skin$/i, '')
    .replace(/,\s*unprepared$/i, '')
    .replace(/,\s*unheated$/i, '')
    .replace(/,\s*no salt added$/i, '')
    .replace(/,\s*low sodium$/i, '')
    .replace(/,\s*rinsed in tap water$/i, '')
    .replace(/,\s*plain or vegetarian$/i, '')
    .replace(/,\s*all types$/i, '')
    .replace(/,\s*all commercial varieties$/i, '')
    .replace(/,\s*mature seeds$/i, '')
    .replace(/,\s*in pod$/i, '')
    .replace(/,\s*fluid$/i, '')
    .replace(/,\s*whole$/i, '')
    .replace(/,\s*NFS$/i, '')
    .replace(/,\s*UHT treated$/i, '')
    .replace(/,\s*pasteurized$/i, '')
    .replace(/,\s*homogenized$/i, '')
    .replace(/\s*\(\s*\)/g, '') // remove empty parens ()
    .replace(/\s*\(Includes.*?\)/gi, '')
    .replace(/,\s*,/g, ',') // fix double commas
    .replace(/,\s*$/g, '') // trailing comma
    .trim();

  if (name !== food.name) {
    await conn.query('UPDATE nutrition_foods SET name = ? WHERE id = ?', [name, food.id]);
    simplified++;
  }
}

console.log(`Simplified ${simplified} names.`);

// ─── STEP 5: Final dedup after name simplification ────────────────────────────
await conn.query(`
  DELETE FROM nutrition_foods
  WHERE id NOT IN (
    SELECT * FROM (SELECT MIN(id) FROM nutrition_foods GROUP BY name) t
  )
`);

const [[{ finalCount }]] = await conn.query('SELECT COUNT(*) as finalCount FROM nutrition_foods');
console.log(`\nFinal entry count: ${finalCount}`);

await conn.end();
