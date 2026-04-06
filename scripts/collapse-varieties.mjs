/**
 * Collapse variety-specific entries into single canonical entries.
 * e.g. "Apples, raw, fuji" + "Apples, raw, gala" → keep only "Apples, raw" (lowest ID)
 * Strategy: for each food, strip variety suffixes, group by canonical name, keep lowest ID, delete rest.
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Step 1: Get all foods
const [rows] = await conn.query('SELECT id, name FROM nutrition_foods ORDER BY id ASC');

// Step 2: Canonical name function - strip variety/cultivar suffixes
function canonicalize(name) {
  let n = name;

  // Apple varieties
  n = n.replace(/,\s*(fuji|gala|golden delicious|granny smith|red delicious|honeycrisp|braeburn|pink lady|jonagold|cortland|mcintosh|rome|winesap|crispin|empire|cameo|jazz|envy|cosmic crisp|pacific rose)\b/gi, '');
  // Pear varieties
  n = n.replace(/,\s*(bartlett|bosc|d'anjou|anjou|comice|concorde|forelle|seckel|starkrimson)\b/gi, '');
  // Grape varieties
  n = n.replace(/,\s*(thompson seedless|red globe|concord|muscat|sultana|flame seedless|cotton candy)\b/gi, '');
  // Tomato varieties
  n = n.replace(/,\s*(roma|cherry|grape|beefsteak|heirloom|sun-dried|plum|vine)\b/gi, '');
  // Potato varieties
  n = n.replace(/,\s*(russet|yukon gold|red|white|purple|fingerling|new|baby)\b/gi, '');
  // Onion varieties
  n = n.replace(/,\s*(yellow|white|red|sweet|vidalia|shallot)\b/gi, '');
  // Pepper varieties
  n = n.replace(/,\s*(red|green|yellow|orange|banana|anaheim|poblano|serrano|habanero|cayenne)\b/gi, '');
  // Mushroom varieties
  n = n.replace(/,\s*(white|brown|cremini|portobello|portabella|shiitake|oyster|button|enoki)\b/gi, '');
  // Squash varieties
  n = n.replace(/,\s*(butternut|acorn|spaghetti|delicata|kabocha|hubbard|carnival)\b/gi, '');
  // Berry varieties
  n = n.replace(/,\s*(cultivated|wild|frozen|fresh)\b/gi, '');
  // Beef cuts - keep generic
  n = n.replace(/,\s*(top round|bottom round|eye of round|inside round|outside round|top sirloin|bottom sirloin|tri-tip|flank|skirt|hanger|chuck roll|chuck eye|blade|clod|brisket flat|brisket point|short ribs|back ribs|plate|navel|shank cross cut)\b/gi, '');
  // Chicken parts - keep breast/thigh/drumstick/wing/back but remove sub-varieties
  n = n.replace(/,\s*(with skin|without skin|skinless|skin on)\b/gi, '');
  // Pork cuts - remove sub-varieties
  n = n.replace(/,\s*(center loin|sirloin|rib end|blade end|country-style|st\. louis style|baby back|spare)\b/gi, '');
  // Lamb cuts
  n = n.replace(/,\s*(domestic|imported|new zealand|australian)\b/gi, '');
  // Fish - remove sub-varieties
  n = n.replace(/,\s*(atlantic|pacific|chinook|coho|sockeye|pink|chum|king|silver|farmed|wild|wild-caught)\b/gi, '');
  // Nut varieties
  n = n.replace(/,\s*(dry roasted|oil roasted|honey roasted|salted|unsalted|blanched|unblanched|sliced|slivered|chopped|whole|halves|pieces)\b/gi, '');
  // Dairy - remove fat % variants that create near-duplicates
  // (keep 1%, 2%, whole, skim as those are meaningfully different)
  // Remove brand-specific suffixes
  n = n.replace(/,\s*(lowfat|low-fat|nonfat|non-fat|fat free|fat-free|reduced fat|full fat|whole milk|part skim)\b/gi, '');
  // Remove trailing commas and spaces
  n = n.replace(/,\s*,/g, ',').replace(/,\s*$/g, '').replace(/\s{2,}/g, ' ').trim();

  return n;
}

// Step 3: Group by canonical name
const groups = new Map(); // canonical -> [{id, name}]
for (const row of rows) {
  const canonical = canonicalize(row.name);
  if (!groups.has(canonical)) groups.set(canonical, []);
  groups.get(canonical).push({ id: row.id, name: row.name });
}

// Step 4: For groups with multiple entries, keep lowest ID, delete rest
// Also rename the kept entry to the canonical name if different
let deleted = 0;
let renamed = 0;

for (const [canonical, entries] of groups) {
  if (entries.length === 1) {
    // Just rename if needed
    if (entries[0].name !== canonical) {
      await conn.query('UPDATE nutrition_foods SET name = ? WHERE id = ?', [canonical, entries[0].id]);
      renamed++;
    }
    continue;
  }
  // Keep lowest ID
  const keeper = entries[0]; // already sorted by id ASC
  const toDelete = entries.slice(1).map(e => e.id);
  await conn.query(`DELETE FROM nutrition_foods WHERE id IN (${toDelete.map(() => '?').join(',')})`, toDelete);
  deleted += toDelete.length;
  // Rename keeper to canonical
  if (keeper.name !== canonical) {
    await conn.query('UPDATE nutrition_foods SET name = ? WHERE id = ?', [canonical, keeper.id]);
    renamed++;
  }
}

const [[{ total }]] = await conn.query('SELECT COUNT(*) as total FROM nutrition_foods');
console.log(`Deleted: ${deleted} variety duplicates`);
console.log(`Renamed: ${renamed} entries to canonical names`);
console.log(`Final count: ${total}`);

await conn.end();
