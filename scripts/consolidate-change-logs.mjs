/**
 * One-time migration: consolidate same-day change log entries into a single row per user per day.
 * Merges all `changes` arrays, keeps the earliest changedAt, keeps the first non-null note,
 * then deletes the duplicate rows.
 */
import mysql from "mysql2/promise";

function toLocalDateKey(ts) {
  const d = new Date(ts);
  // Use local date (server timezone) — same logic as the frontend
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function consolidateTable(conn, tableName) {
  const [rows] = await conn.execute(
    `SELECT id, userId, coachId, changes, note, changedAt FROM ${tableName} ORDER BY userId, changedAt ASC`
  );

  // Group by userId + dateKey
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.userId}::${toLocalDateKey(row.changedAt)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }

  let merged = 0;
  let deleted = 0;

  for (const [key, group] of groups) {
    if (group.length <= 1) continue; // nothing to merge

    // Merge: keep earliest row, combine all changes, keep first non-null note
    const keeper = group[0]; // earliest (ASC sort)
    const allChanges = group.flatMap(r => {
      try {
        const c = typeof r.changes === "string" ? JSON.parse(r.changes) : r.changes;
        return Array.isArray(c) ? c : [];
      } catch {
        return [];
      }
    });
    const mergedNote = group.map(r => r.note).find(n => n != null) ?? null;
    const idsToDelete = group.slice(1).map(r => r.id);

    // Update the keeper row
    await conn.execute(
      `UPDATE ${tableName} SET changes = ?, note = ? WHERE id = ?`,
      [JSON.stringify(allChanges), mergedNote, keeper.id]
    );

    // Delete the duplicates
    await conn.execute(
      `DELETE FROM ${tableName} WHERE id IN (${idsToDelete.map(() => "?").join(",")})`,
      idsToDelete
    );

    console.log(`  [${tableName}] Merged ${group.length} entries for key "${key}" → kept id=${keeper.id}, deleted ids=${idsToDelete.join(",")}`);
    merged++;
    deleted += idsToDelete.length;
  }

  console.log(`  [${tableName}] Done: ${merged} groups merged, ${deleted} rows deleted.`);
}

const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  console.log("Consolidating program_change_logs...");
  await consolidateTable(conn, "program_change_logs");
  console.log("Consolidating cardio_change_logs...");
  await consolidateTable(conn, "cardio_change_logs");
  console.log("Migration complete.");
} finally {
  await conn.end();
}
