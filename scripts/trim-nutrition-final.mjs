import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
let total = 0;

async function del(pattern) {
  const [[{ cnt }]] = await conn.query(
    'SELECT COUNT(*) as cnt FROM nutrition_foods WHERE LOWER(name) LIKE LOWER(?)', [pattern]
  );
  if (cnt > 0) {
    await conn.query('DELETE FROM nutrition_foods WHERE LOWER(name) LIKE LOWER(?)', [pattern]);
    total += cnt;
  }
  return cnt;
}

async function keepOnly(prefix, keepTerms) {
  const [rows] = await conn.query(
    'SELECT id, name FROM nutrition_foods WHERE LOWER(name) LIKE ?', [prefix.toLowerCase() + '%']
  );
  let deleted = 0;
  for (const row of rows) {
    const lower = row.name.toLowerCase();
    const keep = keepTerms.some(k => lower.includes(k));
    if (!keep) {
      await conn.query('DELETE FROM nutrition_foods WHERE id = ?', [row.id]);
      deleted++;
      total++;
    }
  }
  if (deleted > 0) console.log(`Trimmed ${deleted} from ${prefix}`);
}

// Fish: keep only common species
await keepOnly('Fish', ['salmon', 'tuna', 'cod', 'tilapia', 'sardine', 'anchov', 'shrimp', 'prawn',
  'trout', 'barramundi', 'snapper', 'bream', 'whiting', 'haddock', 'halibut', 'bass',
  'swordfish', 'mackerel', 'herring', 'catfish', 'pollock', 'flathead', 'milkfish']);

// Nuts: keep common ones
await keepOnly('Nut', ['almond', 'cashew', 'walnut', 'peanut', 'pistachio', 'macadamia', 'pecan', 'hazelnut', 'brazil', 'pine nut', 'mixed']);

// Yogurt: keep plain, greek, vanilla, strawberry, blueberry, whole milk, low fat, nonfat
await keepOnly('Yogurt', ['plain', 'greek', 'vanilla', 'strawberry', 'blueberry', 'whole milk', 'low fat', 'lowfat', 'nonfat']);

// Beef: keep ground, tenderloin, sirloin, ribeye, steak, roast, brisket, rib, chuck, corned
await keepOnly('Beef', ['ground', 'mince', 'tenderloin', 'sirloin', 'ribeye', 'rib eye', 't-bone', 'steak', 'roast', 'brisket', 'rib', 'chuck', 'cured', 'corned']);

// Oil: keep common ones
await keepOnly('Oil', ['olive', 'canola', 'coconut', 'vegetable', 'sunflower', 'avocado', 'sesame', 'peanut', 'flaxseed', 'corn', 'soybean', 'palm', 'grapeseed', 'safflower']);

// Cheese: keep common ones
await keepOnly('Cheese', ['cheddar', 'mozzarella', 'parmesan', 'ricotta', 'cottage', 'feta', 'brie', 'gouda', 'swiss', 'cream cheese', 'provolone', 'colby', 'camembert', 'blue', 'monterey']);

// Peppers: keep bell, chili, jalapeno, sweet, hot, red, green, yellow
await keepOnly('Peppers', ['bell', 'chili', 'jalap', 'capsicum', 'cayenne', 'serrano', 'habanero', 'sweet', 'hot', 'red', 'green', 'yellow']);

// Squash: keep common ones
await keepOnly('Squash', ['butternut', 'acorn', 'zucchini', 'spaghetti', 'pumpkin', 'summer', 'winter', 'yellow']);

// Cabbage: keep green, red, savoy, napa, chinese, raw
await keepOnly('Cabbage', ['green', 'red', 'savoy', 'napa', 'chinese', 'raw']);

// Milk: keep whole, skim, reduced fat, 2%, 1%, buttermilk, evaporated, condensed, chocolate, goat
await keepOnly('Milk', ['whole', 'skim', 'reduced fat', '2%', '1%', 'buttermilk', 'evaporated', 'condensed', 'chocolate', 'goat']);

// Pork: keep loin, belly, shoulder, ground, mince, bacon, ham, chop, rib, tenderloin, leg
await keepOnly('Pork', ['loin', 'belly', 'shoulder', 'ground', 'mince', 'bacon', 'ham', 'chop', 'rib', 'tenderloin', 'leg', 'butt', 'spareribs']);

// Lamb: keep ground, mince, leg, shoulder, rack, loin, rib, chop, shank
await keepOnly('Lamb', ['ground', 'mince', 'leg', 'shoulder', 'rack', 'loin', 'rib', 'chop', 'shank', 'cutlet']);

// Turkey: keep breast, ground, whole, thigh, drumstick, bacon
await keepOnly('Turkey', ['breast', 'ground', 'whole', 'thigh', 'drumstick', 'bacon', 'mince']);

// Mushroom: keep white, button, portobello, shiitake
await keepOnly('Mushroom', ['white', 'button', 'portobello', 'portabella', 'shiitake', 'raw', 'whole']);

// Lettuce: keep iceberg, romaine, cos, raw
await keepOnly('Lettuce', ['iceberg', 'romaine', 'cos', 'raw', 'red leaf', 'green leaf']);

// Rice: keep white long-grain, brown long-grain, jasmine, basmati
await keepOnly('Rice', ['white, long-grain, regular', 'brown, long-grain', 'jasmine', 'basmati', 'wild']);

// Potato: keep raw, sweet potato raw
await keepOnly('Potato', ['raw', 'sweet']);

// Beans: keep kidney, black, chickpea, lentil, navy, pinto, edamame
await keepOnly('Beans', ['kidney', 'black', 'chickpea', 'lentil', 'navy', 'pinto', 'edamame', 'great northern', 'cannellini']);

// Corn: keep sweet corn raw/frozen/canned only
await keepOnly('Corn', ['sweet corn', 'yellow, raw', 'white, raw']);

// Broccoli: keep raw only
await keepOnly('Broccoli', ['raw']);

// Onion: keep raw, yellow, red, white, green
await keepOnly('Onion', ['raw', 'yellow', 'red', 'white', 'green', 'spring']);

// Butter: keep unsalted, salted only
await keepOnly('Butter', ['unsalted', 'salted', 'without salt']);

// Peanut butter: keep smooth/creamy and chunky only
await keepOnly('Peanut butter', ['smooth', 'creamy', 'chunky', 'chunk style', 'natural']);

// Peanuts: keep dry roasted and raw
await keepOnly('Peanuts', ['dry roasted', 'raw', 'oil roasted']);

// Pasta: keep spaghetti, penne, fettuccine, linguine, macaroni, fusilli
await keepOnly('Pasta', ['spaghetti', 'penne', 'fettuccine', 'linguine', 'macaroni', 'fusilli', 'rigatoni', 'bow tie']);

// Cream: keep heavy, half-and-half, sour cream
await keepOnly('Cream', ['heavy', 'half and half', 'half-and-half', 'sour', 'whipping']);

// Remove entirely: soymilk, grapefruit, orange juice, wheat, seed, radishes, pickles, cream substitutes
await del('Soymilk%');
await del('Grapefruit%');
await del('Orange juice%');
await del('Wheat%');
await del('Seed%');
await del('Radishes%');
await del('Pickles%');
await del('Cream substitute%');
await del('Mollusks, abalone%');
await del('Mollusks, clam%');
await del('Mollusks, whelk%');
await del('Mollusks, conch%');
await del('Mollusks, periwinkle%');
await del('Crustaceans, crayfish%');
await del('Crustaceans, spiny lobster%');
await del('Tomato products%');
await del('Tomato juice%');
await del('Tomato paste%');
await del('Tomato puree%');
await del('Tomato sauce%');
await del('Lima beans%');
await del('Pear, asian%');
await del('Pear, canned%');
await del('Broccoli, chinese%');
await del('Broccoli raab%');
await del('Corn, canned%');
await del('Corn, frozen%');
await del('Corn bran%');
await del('Corn flour%');
await del('Corn grain%');
await del('Corn starch%');

// Final dedup
await conn.query(
  'DELETE FROM nutrition_foods WHERE id NOT IN (SELECT * FROM (SELECT MIN(id) FROM nutrition_foods GROUP BY name) t)'
);

const [[{ finalTotal }]] = await conn.query('SELECT COUNT(*) as finalTotal FROM nutrition_foods');
console.log(`\nTotal deleted this pass: ${total}`);
console.log(`Final count: ${finalTotal}`);

await conn.end();
