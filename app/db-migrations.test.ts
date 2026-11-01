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
})
