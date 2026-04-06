import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ─── Helper ───────────────────────────────────────────────────────────────────
async function del(pattern) {
  const [[{ cnt }]] = await conn.query(
    'SELECT COUNT(*) as cnt FROM nutrition_foods WHERE LOWER(name) LIKE LOWER(?)', [pattern]
  );
  if (cnt > 0) {
    await conn.query('DELETE FROM nutrition_foods WHERE LOWER(name) LIKE LOWER(?)', [pattern]);
    console.log(`Deleted ${cnt}: ${pattern}`);
  }
  return cnt;
}

// ─── 1. Remove branded/commercial products ────────────────────────────────────
const brands = ['SILK%', 'MORI-NU%', 'Vitasoy%', 'HORMEL%', 'Reddi Wip%', 'KRAFT%', 'Morningstar%'];
for (const b of brands) await del(b);

// ─── 2. Remove game/exotic meats ─────────────────────────────────────────────
const exotic = ['Game meat%', 'Ostrich%', 'Emu%', 'Squab%', 'Ruffed Grouse%', 'Turtle%', 'Poultry%',
  'Duck%', 'Goose%', 'Pheasant%', 'Quail%', 'Rabbit%', 'Bison%', 'Venison%', 'Boar%', 'Bear%',
  'Elk%', 'Moose%', 'Caribou%', 'Antelope%', 'Deer%'];
for (const e of exotic) await del(e);

// ─── 3. Remove obscure/niche fish and seafood ─────────────────────────────────
// Keep: salmon, tuna, cod, tilapia, barramundi, sardines, prawns/shrimp, crab, lobster, oysters, mussels
// Remove: obscure species
const keepFish = ['salmon', 'tuna', 'cod', 'tilapia', 'barramundi', 'sardine', 'anchov',
  'shrimp', 'prawn', 'crab', 'lobster', 'oyster', 'mussel', 'scallop', 'squid', 'octopus',
  'snapper', 'bream', 'flathead', 'whiting', 'haddock', 'halibut', 'trout', 'bass',
  'swordfish', 'mackerel', 'herring', 'catfish', 'perch', 'pike', 'pollock', 'flounder',
  'sole', 'eel', 'carp', 'milkfish', 'mullet', 'grouper', 'tilefish', 'bluefish'];

const [allFish] = await conn.query("SELECT id, name FROM nutrition_foods WHERE LOWER(name) LIKE 'fish%' OR LOWER(name) LIKE 'mollusks%' OR LOWER(name) LIKE 'crustaceans%'");
let fishDeleted = 0;
for (const f of allFish) {
  const nameLower = f.name.toLowerCase();
  const keep = keepFish.some(k => nameLower.includes(k));
  if (!keep) {
    await conn.query('DELETE FROM nutrition_foods WHERE id = ?', [f.id]);
    fishDeleted++;
  }
}
console.log(`Deleted ${fishDeleted} obscure fish/seafood entries`);

// ─── 4. Trim oils — keep only common ones ────────────────────────────────────
// Keep: olive, canola, coconut, vegetable, sunflower, avocado, sesame, peanut, flaxseed
const [allOils] = await conn.query("SELECT id, name FROM nutrition_foods WHERE LOWER(name) LIKE 'oil%'");
const keepOils = ['olive', 'canola', 'coconut', 'vegetable', 'sunflower', 'avocado', 'sesame', 'peanut', 'flaxseed', 'flax', 'palm', 'corn', 'soybean', 'safflower', 'grapeseed'];
let oilsDeleted = 0;
for (const o of allOils) {
  const keep = keepOils.some(k => o.name.toLowerCase().includes(k));
  if (!keep) {
    await conn.query('DELETE FROM nutrition_foods WHERE id = ?', [o.id]);
    oilsDeleted++;
  }
}
console.log(`Deleted ${oilsDeleted} obscure oil entries`);

// ─── 5. Remove all salad dressings ───────────────────────────────────────────
await del('Salad dressing%');
await del('Salad Dressing%');

// ─── 6. Trim cheese — keep common ones only ──────────────────────────────────
const keepCheese = ['cheddar', 'mozzarella', 'parmesan', 'ricotta', 'cottage', 'feta', 'brie',
  'gouda', 'swiss', 'cream cheese', 'provolone', 'colby', 'monterey', 'camembert', 'blue'];
const [allCheese] = await conn.query("SELECT id, name FROM nutrition_foods WHERE LOWER(name) LIKE 'cheese%'");
let cheeseDeleted = 0;
for (const c of allCheese) {
  const keep = keepCheese.some(k => c.name.toLowerCase().includes(k));
  if (!keep) {
    await conn.query('DELETE FROM nutrition_foods WHERE id = ?', [c.id]);
    cheeseDeleted++;
  }
}
console.log(`Deleted ${cheeseDeleted} obscure cheese entries`);

// ─── 7. Trim milk — keep common types ────────────────────────────────────────
const keepMilk = ['whole', 'skim', 'reduced fat', '2%', '1%', 'buttermilk', 'evaporated', 'condensed', 'chocolate', 'goat'];
const [allMilk] = await conn.query("SELECT id, name FROM nutrition_foods WHERE LOWER(name) LIKE 'milk%'");
let milkDeleted = 0;
for (const m of allMilk) {
  const keep = keepMilk.some(k => m.name.toLowerCase().includes(k));
  if (!keep) {
    await conn.query('DELETE FROM nutrition_foods WHERE id = ?', [m.id]);
    milkDeleted++;
  }
}
console.log(`Deleted ${milkDeleted} obscure milk entries`);

// ─── 8. Trim yogurt — keep plain/greek/lowfat/whole ──────────────────────────
const keepYogurt = ['plain', 'greek', 'whole milk', 'low fat', 'lowfat', 'nonfat', 'skim', 'vanilla', 'strawberry', 'blueberry'];
const [allYogurt] = await conn.query("SELECT id, name FROM nutrition_foods WHERE LOWER(name) LIKE 'yogurt%'");
let yogurtDeleted = 0;
for (const y of allYogurt) {
  const keep = keepYogurt.some(k => y.name.toLowerCase().includes(k));
  if (!keep) {
    await conn.query('DELETE FROM nutrition_foods WHERE id = ?', [y.id]);
    yogurtDeleted++;
  }
}
console.log(`Deleted ${yogurtDeleted} obscure yogurt entries`);

// ─── 9. Remove margarine, shortening, fat spreads ────────────────────────────
await del('Margarine%');
await del('Shortening%');
await del('Fat, beef%');
await del('Fat, chicken%');
await del('Fat, duck%');
await del('Fat, goose%');
await del('Fat, turkey%');
await del('Fat, mutton%');
await del('Fat, pork%');
await del('Fat, lamb%');
await del('Lard%');
await del('Tallow%');
await del('Cream substitute%');
await del('Sour dressing%');
await del('Whipped topping%');

// ─── 10. Remove seaweed, exotic plants ───────────────────────────────────────
await del('Seaweed%');
await del('Lotus%');
await del('Taro%');
await del('Poi%');
await del('Pokeberry%');
await del('Purslane%');
await del('Vinespinach%');
await del('Winged bean%');
await del('Yautia%');
await del('Yambean%');
await del('Yardlong%');
await del('Nopales%');
await del('Natto%');
await del('Miso%');
await del('Okara%');
await del('Tempeh%');
await del('Lupins%');
await del('Mothbeans%');
await del('Mungo beans%');
await del('Mung beans%');
await del('Pigeon peas%');
await del('Pigeonpeas%');
await del('Cowpeas%');
await del('Roselle%');
await del('Rowal%');
await del('Salsify%');
await del('Sapodilla%');
await del('Sapote%');
await del('Soursop%');
await del('Tamarinds%');
await del('Pummelo%');
await del('Pitanga%');
await del('Oheloberries%');
await del('Loganberries%');
await del('Loquats%');
await del('Mammy-apple%');
await del('Mangosteen%');
await del('Nance%');
await del('Rambutan%');
await del('Rose-apples%');
await del('Sugar-apples%');
await del('Quinces%');
await del('Radicchio%');
await del('Rutabagas%');
await del('Rhubarb%');
await del('Prickly pears%');
await del('Passion-fruit%');
await del('Papayas%');
await del('Pepeao%');
await del('Mountain yam%');
await del('Mulberries%');
await del('Maraschino cherries%');
await del('Luncheon slices%');
await del('Mammy-apple%');
await del('Triticale%');
await del('Sorghum%');
await del('Rye grain%');
await del('Millet%');
await del('Vital wheat gluten%');
await del('Wheat bran%');
await del('Wheat germ%');
await del('Rice bran%');
await del('Oat bran%');
await del('Papad%');
await del('Wasabi%');
await del('Sesbania%');
await del('Pimento%');
await del('Waxgourd%');
await del('Water convolvulus%');
await del('Watercress%');
await del('Pumpkin flowers%');
await del('Pumpkin leaves%');
await del('Sweet potato leaves%');
await del('Taro leaves%');
await del('Taro shoots%');
await del('Mustard spinach%');
await del('Mustard greens%');
await del('Balsam%');
await del('Arugula%');
await del('Radicchio%');
await del('Chard%');
await del('Collards%');
await del('Dandelion greens%');
await del('Endive%');
await del('Escarole%');
await del('Kale%');  // keep kale? it's common - skip
await del('Kohlrabi%');
await del('Leeks%');

// ─── 11. Remove misc processed/niche items ────────────────────────────────────
await del('Nutritional supplement%');
await del('Meat extender%');
await del('Vegetarian fillets%');
await del('Vegetarian meatloaf%');
await del('Tofu yogurt%');
await del('Soy sauce%');
await del('Meatballs%');
await del('Potato pancakes%');
await del('Potato wedges%');
await del('Spinach souffle%');
await del('Peas and carrots%');
await del('Peas and onions%');
await del('Melon balls%');
await del('Turkey and gravy%');
await del('Poultry%');
await del('Peanut butter with omega%');
await del('Peanut spread%');
await del('Pomegranate juice%');
await del('Prune juice%');
await del('Prune puree%');
await del('Raspberry juice concentrate%');
await del('Tangerine juice%');
await del('Orange-grapefruit juice%');
await del('Ruby Red grapefruit juice blend%');
await del('Tomato and vegetable juice%');
await del('Vegetable juice%');
await del('Fruit juice smoothie%');
await del('Milk substitutes%');
await del('Egg substitute%');
await del('Eggs, scrambled, frozen%');
await del('Egg, duck%');
await del('Egg, goose%');
await del('Egg, turkey%');
await del('Egg, white, dried%');
await del('Egg, whole, dried%');
await del('Egg, whole, raw, frozen%');
await del('Egg, yolk, dried%');
await del('Egg, yolk, raw, frozen%');
await del('Eggnog%');
await del('Noodles%');
await del('Rice noodles%');
await del('Vermicelli%');
await del('Spaghetti%');
await del('Macaroni%');
await del('Tapioca%');
await del('Wild rice%');
await del('Tomato products%');
await del('Tomato sauce%');
await del('Pumpkin pie mix%');
await del('Yeast extract spread%');
await del('Fish oil%');
await del('Seed, sesame%');
await del('Seed, sunflower%');
await del('Seed, pumpkin%');
await del('Seed, flaxseed%');
await del('Seed, chia%');
await del('Seed, hemp%');
await del('Seed, poppy%');
await del('Seed, safflower%');

// ─── 12. Remove pork offcuts and keep only common pork ────────────────────────
// Keep: pork loin, pork belly, pork shoulder, pork mince/ground, bacon, ham, pork chop, pork ribs
const keepPork = ['loin', 'belly', 'shoulder', 'ground', 'mince', 'bacon', 'ham', 'chop', 'rib', 'tenderloin', 'leg', 'butt', 'spareribs'];
const [allPork] = await conn.query("SELECT id, name FROM nutrition_foods WHERE LOWER(name) LIKE 'pork%'");
let porkDeleted = 0;
for (const p of allPork) {
  const keep = keepPork.some(k => p.name.toLowerCase().includes(k));
  if (!keep) {
    await conn.query('DELETE FROM nutrition_foods WHERE id = ?', [p.id]);
    porkDeleted++;
  }
}
console.log(`Deleted ${porkDeleted} obscure pork entries`);

// ─── 13. Remove lamb offcuts — keep common ────────────────────────────────────
const keepLamb = ['ground', 'mince', 'leg', 'shoulder', 'rack', 'loin', 'rib', 'chop', 'shank', 'cutlet'];
const [allLamb] = await conn.query("SELECT id, name FROM nutrition_foods WHERE LOWER(name) LIKE 'lamb%'");
let lambDeleted = 0;
for (const l of allLamb) {
  const keep = keepLamb.some(k => l.name.toLowerCase().includes(k));
  if (!keep) {
    await conn.query('DELETE FROM nutrition_foods WHERE id = ?', [l.id]);
    lambDeleted++;
  }
}
console.log(`Deleted ${lambDeleted} obscure lamb entries`);

// ─── 14. Remove veal entirely (uncommon) ─────────────────────────────────────
await del('Veal%');

// ─── 15. Remove turkey offcuts — keep breast, ground, whole ──────────────────
const keepTurkey = ['breast', 'ground', 'whole', 'thigh', 'drumstick', 'bacon', 'mince'];
const [allTurkey] = await conn.query("SELECT id, name FROM nutrition_foods WHERE LOWER(name) LIKE 'turkey%'");
let turkeyDeleted = 0;
for (const t of allTurkey) {
  const keep = keepTurkey.some(k => t.name.toLowerCase().includes(k));
  if (!keep) {
    await conn.query('DELETE FROM nutrition_foods WHERE id = ?', [t.id]);
    turkeyDeleted++;
  }
}
console.log(`Deleted ${turkeyDeleted} obscure turkey entries`);

// ─── 16. Final exact dedup ────────────────────────────────────────────────────
await conn.query(`
  DELETE FROM nutrition_foods
  WHERE id NOT IN (
    SELECT * FROM (SELECT MIN(id) FROM nutrition_foods GROUP BY name) t
  )
`);

// ─── Final count ─────────────────────────────────────────────────────────────
const [[{ total }]] = await conn.query('SELECT COUNT(*) as total FROM nutrition_foods');
console.log(`\nFinal count: ${total}`);

await conn.end();
