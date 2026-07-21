# Archived migration history (pre-2026-07-21 reconciliation)

`drizzle-kit`'s migration journal (`meta/_journal.json`) only ever tracked
migrations `0000`–`0008` (the snapshots stop at an 8-table/14-table schema).
Migrations `0009` onward — up through `0019` — were added as hand-written
SQL files directly, without ever running `drizzle-kit generate`, so the
journal and snapshots never caught up. By the time `drizzle/schema.ts` had
grown to 37 declared tables, `drizzle-kit generate` was diffing against a
snapshot that only knew about 14 of them, and would try to "recreate"
everything since 0008 as if it were new — including prompting to disambiguate
already-existing columns as creates vs. renames.

This folder holds that entire pre-reconciliation migration chain (SQL files
+ the stale meta/journal) for historical reference. It is **not** part of
the active migration chain `drizzle-kit` reads from — see `../0000_baseline.sql`
and `../meta/` for the new one.

## What the reconciliation did

1. Introspected the live database directly (`drizzle-kit introspect`) to get
   ground truth, independent of any of the above. This surfaced two tables —
   `check_in_skips` and `coach_settings` — that exist in the live DB but were
   never declared in `schema.ts` at all (not even in these archived migration
   files, in `coach_settings`' case). Checked their row counts: `check_in_skips`
   had 2 rows, `coach_settings` had 0. Both read as abandoned/superseded rather
   than a live feature that's silently broken — `check_in_skips` looks
   superseded by the `skipped` column now on `check_in_history` — but this is
   worth a second look if either name means something to you.
2. Generated a fresh baseline migration (`../0000_baseline.sql`) representing
   the current `drizzle/schema.ts` from an empty starting point — this is
   the new source of truth going forward.
3. Manually recorded that baseline as already-applied in the live DB's
   `__drizzle_migrations` tracking table (matching drizzle-kit's own hash
   format: sha256 of the migration file's contents), without actually
   running its SQL — every table/column/index it describes already exists
   live. This is the standard way to "adopt" drizzle-kit onto an existing,
   already-provisioned database.

After this, `drizzle-kit generate` and `drizzle-kit migrate` (and `pnpm
db:push`, which runs both) should work normally again for any new schema
change.
