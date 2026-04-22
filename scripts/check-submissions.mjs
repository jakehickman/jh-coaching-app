import { createConnection } from 'mysql2/promise';

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);

  console.log('\n=== check_in_submissions (all rows) ===');
  const [subs] = await conn.execute(`
    SELECT cis.id, u.name, cis.client_id, cis.week_start_date, cis.submitted_at, cis.reviewed_at
    FROM check_in_submissions cis
    JOIN users u ON u.id = cis.client_id
    ORDER BY cis.submitted_at DESC
  `);
  console.log(JSON.stringify(subs, null, 2));

  console.log('\n=== check_in_cycles (all rows) ===');
  const [cycles] = await conn.execute(`
    SELECT cc.id, u.name, cc.client_id, cc.due_date, cc.status, cc.submission_id
    FROM check_in_cycles cc
    JOIN users u ON u.id = cc.client_id
    ORDER BY cc.client_id
  `);
  console.log(JSON.stringify(cycles, null, 2));

  console.log('\n=== check_in_history (all rows) ===');
  const [hist] = await conn.execute(`
    SELECT ch.id, u.name, ch.client_id, ch.due_date, ch.submission_id, ch.completed_at
    FROM check_in_history ch
    JOIN users u ON u.id = ch.client_id
    ORDER BY ch.completed_at DESC
  `);
  console.log(JSON.stringify(hist, null, 2));

  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
