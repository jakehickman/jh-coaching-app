/**
 * Add servingUnit + servingGrams to foods that are naturally measured per unit
 * (not fruits/vegetables — those are weighed).
 * 
 * Categories covered:
 * - Eggs (per egg)
 * - Oils/fats (per tbsp)
 * - Butter/spreads (per tbsp)
 * - Nuts/nut butters (per tbsp for butters, per 10g for whole nuts)
 * - Dairy (per slice for cheese, per tbsp for sour cream/cream cheese)
 * - Condiments (per tsp/tbsp)
 * - Protein powders (per scoop)
 * - Bread/wraps (per slice)
 * - Crackers/rice cakes (per piece)
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function setServing(name, unit, grams) {
  const [r] = await conn.query(
    'UPDATE nutrition_foods SET servingUnit = ?, servingGrams = ? WHERE name = ?',
    [unit, grams, name]
  );
  if (r.affectedRows === 0) console.warn(`  NOT FOUND: ${name}`);
  else console.log(`  ✓ ${name} → ${unit} (${grams}g)`);
}

console.log('\n=== Eggs ===');
await setServing('Egg, raw',       'egg (large)',  50);
await setServing('Egg, yolk, raw', 'yolk',         17);

console.log('\n=== Oils & Fats (per tbsp = 14g) ===');
await setServing('Olive oil',       'tbsp', 14);
await setServing('Coconut oil',     'tbsp', 14);
await setServing('Canola oil',      'tbsp', 14);
await setServing('Sunflower oil',   'tbsp', 14);
await setServing('Sesame oil',      'tbsp', 14);
await setServing('Peanut oil',      'tbsp', 14);
await setServing('Flaxseed oil',    'tbsp', 14);
await setServing('Grapeseed oil',   'tbsp', 14);
await setServing('Avocado oil',     'tbsp', 14);
await setServing('Corn oil',        'tbsp', 14);

// No butter entries in DB currently — skip

console.log('\n=== Nut Butters (per tbsp = 16g) ===');
await setServing('Almond butter, salted',   'tbsp', 16);
await setServing('Almond butter, unsalted', 'tbsp', 16);
await setServing('Cashew butter, salted',   'tbsp', 16);
await setServing('Cashew butter, unsalted', 'tbsp', 16);

console.log('\n=== Cheese (per slice ~28g) ===');
await setServing('Cheddar',              'slice', 28);
await setServing('Mozzarella',           'slice', 28);
await setServing('Mozzarella, part-skim','slice', 28);
await setServing('Cheese, swiss',        'slice', 28);
await setServing('Feta',                 'tbsp crumbled', 17);
await setServing('Parmesan',             'tbsp grated',   5);
await setServing('Gouda',                'slice', 28);
await setServing('Brie',                 'slice', 28);
await setServing('Blue cheese',          'tbsp crumbled', 17);
await setServing('Monterey Jack',        'slice', 28);
await setServing('Cheese, provolone',    'slice', 28);

console.log('\n=== Dairy condiments ===');
await setServing('Sour cream', 'tbsp', 12);

console.log('\n=== Protein powders (per scoop ~30g) ===');
await setServing('Whey protein, dried',  'scoop', 30);
await setServing('Soy protein isolate',  'scoop', 30);

console.log('\n=== Condiments & seasonings ===');
await setServing('Black pepper',  'tsp',   2);
await setServing('Garlic, raw',   'clove', 3);
await setServing('Pickle relish', 'tbsp',  15);

console.log('\n=== Done ===');
const [[{ total }]] = await conn.query('SELECT COUNT(*) as total FROM nutrition_foods WHERE servingUnit IS NOT NULL');
console.log(`Foods with serving data: ${total}`);

await conn.end();
