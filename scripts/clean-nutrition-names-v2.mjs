import mysql from 'mysql2/promise';

function cleanName(name) {
  let n = name;

  // ── Phase 1: Strip parenthetical noise blocks ────────────────────────────
  // USDA program notes
  n = n.replace(/\s*\(Includes foods for USDA[''s]* Food Distribution Program\)/gi, '');
  // Parenthetical "raw" at end e.g. "(raw)"
  n = n.replace(/\s*\(raw\)\s*$/i, ', raw');

  // ── Phase 2: Strip comma-separated qualifier phrases ─────────────────────
  const stripPhrases = [
    // Lean/fat separation
    /,?\s*separable lean and fat/gi,
    /,?\s*separable lean only/gi,
    /,?\s*separable fat/gi,
    // Fat trim level e.g. "trimmed to 1/8" fat" or "trimmed to 0" fat"
    /,?\s*trimmed to \d+\/?\d*["″]?\s*fat/gi,
    // USDA grades
    /,?\s*\ball grades\b/gi,
    /,?\s*\bchoice\b/gi,
    /,?\s*\bselect\b/gi,
    /,?\s*\bprime\b/gi,
    // Production class descriptors
    /,?\s*broilers or fryers/gi,
    /,?\s*all classes/gi,
    /,?\s*all commercial varieties/gi,
    /,?\s*domesticated/gi,
    /,?\s*mixed species/gi,
    // Bone qualifiers
    /,?\s*bone-in/gi,
    /,?\s*boneless/gi,
    // Meat/skin qualifiers
    /,?\s*meat and skin/gi,
    /,?\s*meat only/gi,
    // Cooking method on cured/processed meats (keep "raw", "smoked", "roasted" as standalone)
    /,?\s*heated,?\s*roasted/gi,
    /,?\s*heated,?\s*pan-fried/gi,
    // Fluid/fortification on dairy
    /,?\s*fluid/gi,
    /,?\s*protein fortified/gi,
    /,?\s*with added vitamin [a-z](?: and vitamin [a-z])*/gi,
    /,?\s*with added ascorbic acid(?:,? calcium(?:,? and potassium)?)?/gi,
    /,?\s*with added ascorbic acid/gi,
    // Solids/liquids noise
    /,?\s*solids and liquids/gi,
    /,?\s*drained solids(?: with bone)?/gi,
    /,?\s*solids with bone and liquid/gi,
    /,?\s*drained solids/gi,
    // "with salt" / "without salt" / "no salt added" — keep these as they're useful
    // Enrichment noise
    /,?\s*enriched/gi,
    /,?\s*unenriched/gi,
    /,?\s*bleached/gi,
    /,?\s*unbleached/gi,
    // Origin verbose qualifiers
    /,?\s*imported/gi,
    /,?\s*fresh,?\s*(?=leg|loin|shoulder|rib|chuck|round|sirloin|tenderloin|shank|belly|butt|ham)/gi,
    // "with added solution" on poultry
    /,?\s*with added solution/gi,
    // Trotter off
    /,?\s*trotter off/gi,
    // "America's Beef Roast" type marketing names
    /,?\s*America['']s Beef Roast/gi,
    // "low moisture" / "high moisture"
    /,?\s*low moisture/gi,
    /,?\s*high moisture/gi,
    // "mature seeds" on legumes
    /,?\s*mature seeds/gi,
    // "large" / "small" variety on beans (e.g. "Lima beans, large")
    // Keep these as they're useful
    // "unprepared" on frozen veg — keep as useful context
    // "par fried" — keep
    // "sulfured" on dried fruit
    /,?\s*sulfured/gi,
    // "low-moisture" part-skim etc on cheese
    /,?\s*low-moisture/gi,
    // "not reconstituted"
    /,?\s*not reconstituted/gi,
    // "in pod" on beans — keep as useful
    // "debranned"
    /,?\s*partially debranned/gi,
    // Country of origin (Australian, New Zealand) — keep as useful for beef
    // "regular pack" on canned goods
    /,?\s*regular pack/gi,
    // "extra heavy syrup pack" etc — keep as useful
    // "diluted with 3 volume water" on juice concentrate
    /,?\s*diluted with 3 volume water/gi,
    // "undiluted" on concentrate — keep
    // "glandless" on seeds
    /,?\s*\(glandless\)/gi,
    // "non trans" / "high stability" / "high oleic" on oils
    /,?\s*non trans/gi,
    /,?\s*high stability/gi,
    /,?\s*high oleic\s*\(\d+%\)/gi,
    /,?\s*high oleic/gi,
    // "Natreon canola" — keep canola, strip brand
    /,?\s*Natreon/gi,
    // "industrial" on flours/shortenings
    /,?\s*industrial/gi,
    // "15% protein" on flour
    /,?\s*\d+%\s*protein/gi,
    // "square-cut" on lamb
    /,?\s*square-cut/gi,
    // "hind-shank" → just shank
    /hind-shank/gi,
    // "from whole bird"
    /,?\s*from whole bird/gi,
  ];

  for (const pat of stripPhrases) {
    n = n.replace(pat, '');
  }

  // ── Phase 3: Normalise whitespace, trailing commas/dashes ────────────────
  n = n.replace(/\s{2,}/g, ' ').trim();
  n = n.replace(/[,\-–]\s*$/, '').trim();
  // Fix double commas
  n = n.replace(/,\s*,/g, ',').trim();
  n = n.replace(/,\s*$/, '').trim();

  return n;
}

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.execute('SELECT id, name FROM nutrition_foods');
  console.log(`Total rows: ${rows.length}`);

  const updates = [];
  for (const row of rows) {
    const cleaned = cleanName(row.name);
    if (cleaned !== row.name) {
      updates.push({ id: row.id, old: row.name, new: cleaned });
    }
  }

  console.log(`Names to update: ${updates.length}`);

  // Preview first 30
  console.log('\n--- Preview (first 30) ---');
  updates.slice(0, 30).forEach(u => {
    console.log(`  BEFORE: ${u.old}`);
    console.log(`  AFTER:  ${u.new}`);
    console.log('');
  });

  // Apply
  console.log('Applying updates...');
  for (const u of updates) {
    await conn.execute('UPDATE nutrition_foods SET name = ? WHERE id = ?', [u.new, u.id]);
  }
  console.log(`Done. ${updates.length} names updated.`);
  await conn.end();
}

run().catch(console.error);
