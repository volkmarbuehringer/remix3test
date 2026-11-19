import * as fs from 'node:fs'
import * as path from 'node:path'

import { loadConfig } from 'remix/cli'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { before, describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { db, initializeAppDatabase, migrationsJournalTable } from './db.ts'

const MIGRATIONS_DIR = path.join(import.meta.dirname, '../db/migrations')

// ---------------------------------------------------------------------------
// The app adopts the remix/data-table migration runner with a single idempotent
// baseline. These tests pin the journal wiring: every file in db/migrations is
// applied under the app-owned journal table, and the baseline created the core
// tables. A stale `data_table_migrations` row from the pre-2026-08 runner must
// never be consulted again (the app used a distinct journal for that reason).
// ---------------------------------------------------------------------------

describe('app database migrations', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('journals every migration in db/migrations as applied', async () => {
    let migrations = await loadMigrations(MIGRATIONS_DIR)
    assert.ok(migrations.length >= 1, 'at least the baseline migration should exist')

    let status = await db.migrationStatus(migrations, {
      journalTable: migrationsJournalTable,
    })

    assert.equal(status.length, migrations.length, 'every migration should be reported')
    assert.ok(
      status.every((entry) => entry.status === 'applied'),
      'every migration should be applied',
    )
  })

  it('creates the core tables from the baseline', async () => {
    assert.equal(await db.hasTable({ name: 'users' }), true, 'users should exist')
    assert.equal(await db.hasTable({ name: 'appointments' }), true, 'appointments should exist')
    assert.equal(
      await db.hasTable({ name: 'webhook_requests' }),
      true,
      'webhook_requests should exist',
    )
  })

  it('ignores an orphaned legacy data_table_migrations journal', async () => {
    assert.equal(migrationsJournalTable, 'app_migrations')

    // Simulate the old runner's journal: a table with a row whose migration
    // file no longer exists. The new runner must not consult it at all.
    await db.executeScript(`
      CREATE TABLE IF NOT EXISTS data_table_migrations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        batch INTEGER NOT NULL,
        applied_at BIGINT NOT NULL
      );
      INSERT INTO data_table_migrations (id, name, checksum, batch, applied_at)
      VALUES ('20260101000000_removed', 'removed', 'legacy', 1, 0)
      ON CONFLICT (id) DO NOTHING;
    `)

    try {
      await initializeAppDatabase()

      let migrations = await loadMigrations(MIGRATIONS_DIR)
      let status = await db.migrationStatus(migrations, {
        journalTable: migrationsJournalTable,
      })
      assert.ok(
        status.every((entry) => entry.status === 'applied'),
        'the app journal should stay applied despite the legacy orphan',
      )
    } finally {
      await db.executeScript('DROP TABLE IF EXISTS data_table_migrations')
    }
  })

  it('keeps remix.json pointed at the same journal and migration directory', async () => {
    let config = await loadConfig(path.join(import.meta.dirname, '..'))

    assert.equal(
      config.db?.migrations?.journalTable,
      migrationsJournalTable,
      'the CLI journal and the boot journal must match',
    )
    assert.equal(
      path.resolve(import.meta.dirname, '..', config.db?.migrations?.directory ?? ''),
      MIGRATIONS_DIR,
      'the CLI migration directory and the boot directory must match',
    )
  })

  // -------------------------------------------------------------------------
  // Data-repair migrations
  //
  // The repair migration runs unattended at boot, and a fresh test database has
  // no rows for it to touch, so nothing else exercises its SQL. Run the actual
  // up.sql body against seeded poison rows and roll the whole thing back:
  // committing would leak fixtures (and the scan touches every double-encoded
  // row, including rows another test worker owns).
  // -------------------------------------------------------------------------

  it('repairs double-encoded json rows and skips unreadable text', async () => {
    let upSql = fs.readFileSync(
      path.join(MIGRATIONS_DIR, '20261119120000_unwrap_double_encoded_json', 'up.sql'),
      'utf8',
    )
    let stamp = 1_700_000_000_000
    let prefix = `test-repair-migration-${Date.now()}`
    let encodedList = '[{"id":"a","label":"Repair me"}]'

    class Rollback extends Error {}

    try {
      await db.transaction(async (tx) => {
        await tx.exec(
          `INSERT INTO lists (description, list, created_at, updated_at)
           VALUES
             ($1, to_jsonb($4::text), $5, $5),
             ($2, to_jsonb('[not json'::text), $5, $5),
             ($3, '{"nope":true}'::jsonb, $5, $5)`,
          [`${prefix}-encoded`, `${prefix}-broken`, `${prefix}-object`, encodedList, stamp],
        )

        let resource = (
          (await tx.exec(
            `INSERT INTO resources (name, description, created_at, updated_at)
             VALUES ($1, 'repair migration test', $2, $2)
             RETURNING id`,
            [`${prefix}-resource`, stamp],
          )) as { rows: Array<{ id: number }> }
        ).rows[0]!
        let config = (
          (await tx.exec(
            `INSERT INTO offering_configs (resource_id, rules, created_at, updated_at)
             VALUES ($1, to_jsonb($2::text), $3, $3)
             RETURNING id`,
            [resource.id, '{"maxBookings":3}', stamp],
          )) as { rows: Array<{ id: number }> }
        ).rows[0]!

        await tx.executeScript(upSql)

        let repaired = (
          (await tx.exec(
            `SELECT description, jsonb_typeof(list) AS type, list, created_at, updated_at
             FROM lists WHERE description LIKE $1`,
            [`${prefix}%`],
          )) as { rows: Array<Record<string, unknown>> }
        ).rows
        let byDescription = new Map(repaired.map((row) => [String(row.description), row]))

        let encoded = byDescription.get(`${prefix}-encoded`)!
        assert.equal(encoded?.type, 'array', 'a JSONB string containing an array must be unwrapped')
        assert.deepEqual(encoded?.list, [{ id: 'a', label: 'Repair me' }])
        assert.equal(Number(encoded?.created_at), stamp, 'created_at must not change')
        assert.equal(Number(encoded?.updated_at), stamp, 'updated_at must not change')

        let broken = byDescription.get(`${prefix}-broken`)!
        assert.equal(broken?.type, 'string', 'unparseable text must be left alone')
        assert.equal(broken?.list, '[not json')

        let untouched = byDescription.get(`${prefix}-object`)!
        assert.equal(untouched?.type, 'object', 'an already-object payload must not change')

        let configs = (
          (await tx.exec(
            `SELECT jsonb_typeof(rules) AS type, rules FROM offering_configs WHERE id = $1`,
            [config.id],
          )) as { rows: Array<{ type: string; rules: unknown }> }
        ).rows
        assert.equal(configs[0]?.type, 'object', 'a JSONB string containing an object is unwrapped')
        assert.deepEqual(configs[0]?.rules, { maxBookings: 3 })

        // Boot retries after a failed deploy must be safe: a second run neither
        // changes the repaired value nor its timestamps, and only warns on the
        // unreadable row.
        await tx.executeScript(upSql)
        let rerun = (
          (await tx.exec(
            `SELECT jsonb_typeof(list) AS type, list, updated_at
             FROM lists WHERE description = $1`,
            [`${prefix}-encoded`],
          )) as { rows: Array<Record<string, unknown>> }
        ).rows[0]!
        assert.equal(rerun?.type, 'array')
        assert.deepEqual(rerun?.list, [{ id: 'a', label: 'Repair me' }])
        assert.equal(Number(rerun?.updated_at), stamp)

        throw new Rollback()
      })
    } catch (error) {
      if (!(error instanceof Rollback)) throw error
    }
  })
})
