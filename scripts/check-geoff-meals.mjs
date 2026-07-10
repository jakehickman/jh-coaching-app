import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get all users
const [users] = await conn.execute('SELECT id, name, email FROM users');
console.log('All users:');
for (const u of users) {
  console.log(`  id=${u.id} name=${u.name} email=${u.email}`);
}

// Find Geoff (non-Jake user, or search by name)
const geoff = users.find(u => 
  (u.name && u.name.toLowerCase().includes('geoff')) ||
  (u.email && u.email.toLowerCase().includes('geoff'))
);

if (!geoff) {
  // Show all clients with meal logs
  const [withMeals] = await conn.execute(
    `SELECT DISTINCT u.id, u.displayName, u.email, COUNT(m.id) as mealCount 
     FROM users u JOIN meal_logs m ON m.userId = u.id 
     GROUP BY u.id ORDER BY mealCount DESC`
  );
  console.log('\nUsers with meal logs:');
  for (const u of withMeals) {
    console.log(`  id=${u.id} name=${u.name} email=${u.email} meals=${u.mealCount}`);
  }
} else {
  console.log(`\nFound Geoff: id=${geoff.id} name=${geoff.name}`);
  
  // Count total vs null utcOffsetMins
  const [[stats]] = await conn.execute(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN utcOffsetMins IS NULL THEN 1 ELSE 0 END) as nullOffset,
       SUM(CASE WHEN utcOffsetMins IS NOT NULL THEN 1 ELSE 0 END) as hasOffset,
       MIN(loggedAt) as earliest,
       MAX(loggedAt) as latest
     FROM meal_logs WHERE userId = ?`,
    [geoff.id]
  );
  console.log(`\nMeal log stats for ${geoff.name}:`);
  console.log(`  Total meals: ${stats.total}`);
  console.log(`  With utcOffsetMins: ${stats.hasOffset}`);
  console.log(`  Missing utcOffsetMins (null): ${stats.nullOffset}`);
  console.log(`  Date range: ${stats.earliest} → ${stats.latest}`);

  // Show sample of null-offset meals
  const [nullMeals] = await conn.execute(
    `SELECT id, name, loggedAt, utcOffsetMins FROM meal_logs 
     WHERE userId = ? AND utcOffsetMins IS NULL 
     ORDER BY loggedAt DESC LIMIT 10`,
    [geoff.id]
  );
  if (nullMeals.length > 0) {
    console.log(`\nSample meals with null offset (showing up to 10):`);
    for (const m of nullMeals) {
      console.log(`  id=${m.id} "${m.name}" loggedAt=${m.loggedAt} offset=${m.utcOffsetMins}`);
    }
  }
}

await conn.end();
