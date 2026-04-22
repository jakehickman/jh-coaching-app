import { createConnection } from 'mysql2/promise';

const dayMap = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 };

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);

  const [clients] = await conn.execute(`
    SELECT u.id, cp.checkInDay, cp.startDate
    FROM users u
    JOIN client_profiles cp ON cp.userId = u.id
    WHERE cp.checkInDay IS NOT NULL AND cp.startDate IS NOT NULL
  `);

  console.log('Clients found:', clients.length);

  for (const client of clients) {
    const { id, checkInDay, startDate } = client;
    if (!checkInDay || !startDate) {
      console.log('Skipping client', id, '- missing checkInDay or startDate');
      continue;
    }

    // Parse startDate (MySQL date columns come back as Date objects)
    const startStr = startDate instanceof Date
      ? `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth()+1).padStart(2,'0')}-${String(startDate.getUTCDate()).padStart(2,'0')}`
      : startDate;

    const start = new Date(startStr + 'T00:00:00Z');
    const targetDay = dayMap[checkInDay];

    // First occurrence of checkInDay AFTER startDate.
    // If startDate IS the checkInDay, first due = following week (+7 days).
    const startDow = start.getUTCDay();
    let daysUntilFirst = (targetDay - startDow + 7) % 7;
    if (daysUntilFirst === 0) daysUntilFirst = 7;

    const firstDue = new Date(start);
    firstDue.setUTCDate(firstDue.getUTCDate() + daysUntilFirst);
    const dueDateStr = firstDue.toISOString().slice(0, 10);

    // Insert cycle only if no row exists yet for this client
    await conn.execute(
      `INSERT IGNORE INTO check_in_cycles (clientId, dueDate, status) VALUES (?, ?, 'upcoming')`,
      [id, dueDateStr]
    );
    console.log('Seeded client', id, '| checkInDay:', checkInDay, '| startDate:', startStr, '| firstDueDate:', dueDateStr);
  }

  await conn.end();
  console.log('Seed complete');
}

main().catch(e => { console.error(e); process.exit(1); });
