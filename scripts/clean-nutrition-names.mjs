import mysql from 'mysql2/promise';

function cleanName(name) {
  let n = name;

  // 1. Strip USDA program notes in parentheses
  n = n.replace(/\s*\(Includes foods for USDA['']s Food Distribution Program\)/gi, '');
  n = n.replace(/\s*\(Includes foods for USDA's Food Distribution Program\)/gi, '');

  // 2. Strip other common trailing noise phrases (case-insensitive)
  //    These are redundant qualifiers that add no useful info for a client
  const noisePatterns = [
    /,?\s*solids and liquids$/i,
    /,?\s*drained solids$/i,
    /,?\s*solids$/i,
    /,?\s*liquids$/i,
  ];
  for (const pat of noisePatterns) {
    n = n.replace(pat, '');
  }

  // 3. Collapse multiple spaces and trim
  n = n.replace(/\s{2,}/g, ' ').trim();

  // 4. Remove trailing comma or dash left after stripping
  n = n.replace(/[,\-–]\s*$/, '').trim();

  return n;
}

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  const [rows] = await conn.execute('SELECT id, name FROM nutrition_foods');
  console.log(`Total rows: ${rows.length}`);

  let changed = 0;
  const updates = [];

  for (const row of rows) {
    const cleaned = cleanName(row.name);
    if (cleaned !== row.name) {
      updates.push({ id: row.id, old: row.name, new: cleaned });
      changed++;
    }
  }

  console.log(`Names to update: ${changed}`);

  // Preview first 20 changes
  console.log('\n--- Preview (first 20) ---');
  updates.slice(0, 20).forEach(u => {
    console.log(`  BEFORE: ${u.old}`);
    console.log(`  AFTER:  ${u.new}`);
    console.log('');
  });

  // Apply all updates
  console.log('Applying updates...');
  for (const u of updates) {
    await conn.execute('UPDATE nutrition_foods SET name = ? WHERE id = ?', [u.new, u.id]);
  }

  console.log(`Done. ${changed} names updated.`);
  await conn.end();
}

run().catch(console.error);
