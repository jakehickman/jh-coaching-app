/**
 * Sixth-pass cleanup: remove obscure/exotic foods, final duplicates, and rename to clean names
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

// ─── Beef duplicates from renaming ───────────────────────────────────────────
// "Beef, steak, raw" appears twice, "Beef, tenderloin, raw" appears twice
const [beefDups] = await conn.query("SELECT id, name FROM nutrition_foods WHERE name IN ('Beef, steak, raw', 'Beef, tenderloin, raw') ORDER BY id");
const seen = new Map();
for (const row of beefDups) {
  if (seen.has(row.name)) {
    await conn.query('DELETE FROM nutrition_foods WHERE id = ?', [row.id]);
    deleted++;
  } else {
    seen.set(row.name, row.id);
  }
}
// Also fix "Beef, tenderloin, steak, raw" duplicate of "Beef, tenderloin steak, raw"
deleted += await deleteExact('Beef, tenderloin, steak, raw');
// Beef ribeye duplicate
deleted += await deleteExact('Beef, ribeye, raw'); // keep "Beef, rib eye steak, raw"

// ─── Obscure/exotic foods to remove ─────────────────────────────────────────
const toDelete = [
  // Obscure vegetables
  'Borage, raw', 'Burdock root, raw', 'Cardoon, raw', 'Celtuce, raw',
  'Chayote, fruit, raw', 'Chicory greens, raw', 'Chicory roots, raw',
  'Chicory, witloof, raw', 'Chrysanthemum leaves, raw', 'Chrysanthemum, garland, raw',
  'Cress, garden, raw', 'Dock, raw', 'Drumstick leaves, raw', 'Drumstick pods, raw',
  'Epazote, raw', 'Eppaw, raw', 'Fiddlehead ferns, raw', 'Fireweed, leaves, raw',
  'Gourd, dishcloth (towelgourd), raw', 'Gourd-flowered (calabash), raw',
  'Hyacinth beans, raw', 'Hyacinth-beans, im, raw', 'Broadbeans, im, raw',
  'Celeriac, raw', 'Tomatillos, raw', 'Waterchestnuts, chinese, (matai), raw',
  'Waterchestnuts, chinese, canned',
  // Obscure fruits
  'Carambola, (starfruit), raw', 'Carissa, (natal-plum), raw', 'Cherimoya, raw',
  'Durian, raw or frozen', 'Feijoa, raw', 'Groundcherries, (cape-gooseberries or poha), raw',
  'Guavas, strawberry, raw', 'Horned melon (Kiwano)', 'Elderberries, raw',
  // Obscure grains/starches
  'Cassava, raw', 'Breadfruit, raw', 'Yam, raw',
  // Obscure meats/proteins
  'Canada Goose, breast, raw', 'Frog legs, raw', 'Guinea hen, raw',
  // Obscure canned/processed
  'Blackberry juice, canned', 'Beets, harvard, canned', 'Beets, pickled, canned',
  'Succotash, (corn and limas), canned, with whole kernel corn',
  'Crustaceans, crab, alaska king, imitation, made from surimi',
  'Crustaceans, crab, blue, crab cakes, home recipe',
  'Crustaceans, crab, queen, raw',
  'Crustaceans, shrimp, imitation, made from surimi',
  'Crustaceans, shrimp, raw (may contain additives to retain moisture)',
  'Cranberry-orange relish, canned',
  'Cranberry sauce, canned, OCEAN SPRAY',
  'Cranberry sauce, jellied, canned, OCEAN SPRAY',
  'Cranberry juice blend, 100% juice, bottled and calcium',
  'Grape juice, canned or bottled, unsweetened and calcium',
  'Grape leaves, canned', 'Grape leaves, raw',
  'Grape or green (European type, such as Thompson seedless), raw',
  'Grape, american type (slip skin), raw', 'Grape, muscadine, raw',
  'Ginger root, pickled, canned, with artificial sweetener',
  'Cherry juice, tart', 'Cherry, tart, dried, sweetened',
  'Currants and white, raw', 'Currants, european black, raw', 'Currants, zante, dried',
  'Candied fruit',
  // Tofu variants - keep only plain firm
  'Tofu and fermented (fuyu)', 'Tofu, dried-frozen (koyadofu)',
  'HOUSE FOODS Premium Firm Tofu', 'HOUSE FOODS Premium Soft Tofu',
  // Processed/junk
  'Dessert topping, pressurized', 'Dessert topping, semi solid',
  'Fat free ice cream, no sugar added, flavors other than chocolate',
  'Ice cream bar, covered with chocolate and nuts',
  'Dulce de Leche',
  'Frankfurter, meatless',
  'Catsup',
  'Chili with beans, canned',
  'Chicken, wing, glazed, barbecue flavored',
  'Chicken, canned, with broth',
  'Fungi, Cloud ears, dried',
  // Whey variants - keep one
  'Whey', 'Whey, acid', 'Whey, acid, dried',
  // Cabbage variants - keep only raw
  'Cabbage, chinese (pak-choi), raw', 'Cabbage, chinese (pe-tsai), raw',
  'Cabbage, common (danish, and pointed types), freshly harvest, raw',
  'Cabbage, common (danish, and pointed types), stored, raw',
  'Cabbage, savoy, raw',
  // Sweet potato canned variants
  'Sweet potato, canned, mashed', 'Sweet potato, canned, syrup pack',
  'Sweet potato, canned, vacuum pack',
  // Tomato variants - keep raw and crushed canned
  'Tomato', 'Tomato, ripe, canned, with green chilies',
  'Tomato, ripe, raw, year round average', 'Tomato, packed in oil, drained',
  // Beet variants
  'Beet greens, raw', 'Beets, canned',
  // Chickpea duplicate
  'Chickpeas (garbanzo beans, bengal gram), canned, drained',
  // Broadbeans
  'Broadbeans (fava beans), canned',
  // Succotash
  'Succotash, (corn and limas), raw',
  // Cheese duplicates/processed
  'Cheese, pasteurized process, cheddar or American',
  'Cheese, pasteurized process, swiss',
  'Cheese, swiss, low fat',
  'Cheese, parmesan, shredded',
  // Turkey duplicates
  'Turkey, Ground, raw',  // duplicate of Turkey, ground, raw
  'Turkey, retail parts, breast, raw',  // duplicate of Turkey, breast, raw
  'Turkey, retail parts, drumstick, raw',
  'Turkey, retail parts, thigh, raw',
  'Turkey, skin (light and dark), raw',
  'Turkey, skin from whole (light and dark), raw',
  // Fish duplicates
  'Fish, mackerel',  // duplicate of Mackerel, raw
  // Misc
  'Chives, freeze-dried',
  'Goji berries, dried',
  'Blueberry',  // duplicate of Blueberry, raw
  'Blueberry, dried, sweetened',
  'Cranberries, dried, sweetened',
  'Date, deglet noor',  // keep medjool only
  'Hominy, canned',
  'Hummus, commercial',
];
for (const n of toDelete) deleted += await deleteExact(n);

// ─── Rename remaining to clean names ─────────────────────────────────────────
await rename('Crustaceans, crab, alaska king, raw', 'Crab, king, raw');
await rename('Crustaceans, crab, blue, canned', 'Crab, blue, canned');
await rename('Crustaceans, crab, blue, raw', 'Crab, blue, raw');
await rename('Crustaceans, crab, dungeness, raw', 'Crab, dungeness, raw');
await rename('Crustaceans, lobster, northern, raw', 'Lobster, raw');
await rename('Crustaceans, shrimp, canned', 'Shrimp, canned');
await rename('Crustaceans, shrimp, raw', 'Shrimp, raw');
await rename('Tomato, raw', 'Tomato, raw');
await rename('Tomato, ripe, canned, packed in tomato juice', 'Tomato, canned');
await rename('Tomato, crushed, canned', 'Tomato, crushed, canned');
await rename('Cabbage, raw', 'Cabbage, raw');
await rename('Beets, raw', 'Beets, raw');
await rename('Whey, dried', 'Whey protein, dried');
await rename('Guavas, common, raw', 'Guava, raw');
await rename('Tangerines, (mandarin oranges), raw', 'Mandarin oranges, raw');
await rename('Grape juice, canned or bottled, unsweetened', 'Grape juice');
await rename('Cranberry juice, unsweetened', 'Cranberry juice');
await rename('Cherry, sour, raw', 'Cherries, sour, raw');
await rename('Cherry, raw', 'Cherries, raw');
await rename('Date, medjool', 'Dates, medjool');
await rename('Fig, raw', 'Figs, raw');
await rename('Blackberry, raw', 'Blackberries, raw');
await rename('Blueberry, raw', 'Blueberries, raw');
await rename('Chickpeas (garbanzo beans, bengal gram), raw', 'Chickpeas, raw');
await rename('Chickpeas (garbanzo beans, bengal gram), canned', 'Chickpeas, canned');
await rename('Broadbeans (fava beans), raw', 'Fava beans, raw');
await rename('Turkey, ground, raw', 'Turkey, ground, raw');
await rename('Turkey, ground, 85% lean, 15% fat, raw', 'Turkey, ground (85/15), raw');
await rename('Turkey, ground, 93% lean, 7% fat, raw', 'Turkey, ground (93/7 lean), raw');

const [[{ total }]] = await conn.query('SELECT COUNT(*) as total FROM nutrition_foods');
console.log(`Deleted this pass: ${deleted}`);
console.log(`Final count: ${total}`);

// Show final list
const [allFoods] = await conn.query("SELECT name FROM nutrition_foods ORDER BY name");
allFoods.forEach(r => console.log(' -', r.name));

await conn.end();
