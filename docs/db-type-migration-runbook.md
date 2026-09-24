# Database Type-Migration Runbook

Status: **planned — not executed**
Origin: 2026-09-24 database review, finding #9 ("schema type choices")
Audience: whoever holds `DATABASE_URL` write access and a maintenance window

This runbook covers three independent, optional modernizations. They are **not**
required today: the database is small (largest app table: `audit_logs` at 276
rows) and none of these types are close to exhaustion. Do them only when the
trigger for each item is met, and do them one at a time.

| Item                               | Trigger to act                                           | Effort               | Risk        | Downtime                        |
| ---------------------------------- | -------------------------------------------------------- | -------------------- | ----------- | ------------------------------- |
| C. `webhook_requests` UUID v4 → v7 | Index bloat hurts insert throughput                      | minutes              | Low         | none                            |
| A. `int4` `SERIAL` PK → `bigint`   | Any PK approaching ~1B rows                              | 1–2 days (app + SQL) | Medium      | seconds–minutes at current size |
| B. epoch-`BIGINT` → `timestamptz`  | Timezone-correct reporting / time partitioning is needed | 3–5 days             | Medium–High | expand/contract, no downtime    |

---

## 0. Universal pre-flight

Run every item with these steps first:

1. **Back up.** Use a custom-format dump so it restores selectively:
   ```sh
   pg_dump -Fc "$DATABASE_URL" > "backup-$(date +%F-%H%M).dump"
   ```
2. **Confirm version and extensions:**
   ```sql
   SELECT version();
   SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm','btree_gist','pgcrypto');
   ```
3. **Stop application writes.** Stop the server (`npm run start` / the dev
   watcher) for the duration. `initializeAppDatabase()` runs `db/schema.sql` on
   boot; run these migrations with the app stopped so a concurrent boot cannot
   interleave DDL.
4. **Keep `db/schema.sql` and the manual migration in sync.** `db/schema.sql`
   is a fresh-database bootstrap only; existing databases need the manual
   migration in `db/manual-migrations/`. Update both in the same commit.
5. **Run it on the ephemeral test database first.** `npm test` builds a fresh
   database from `db/schema.sql` (`test/setup.ts`), so a full server test run
   is the cheapest end-to-end check that the schema change is coherent:
   ```sh
   NODE_ENV=test npx remix test --glob.exclude '**/*.test.browser.*' --glob.exclude '**/*.test.e2e.*'
   ```
6. **Verify, then commit.** Verification queries are listed per item.

Rollback for every item is the inverse DDL, applied from the backup if data was
rewritten. Items A and B only become irreversible once the old columns are
dropped; keep the old columns until the new ones are verified.

---

## C. `webhook_requests` random UUID PK → UUIDv7 (do this first — it is one line)

**Current** ([db/schema.sql:211](db/schema.sql#L211)):

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

`gen_random_uuid()` is UUIDv4: uniformly random, so every insert lands in a
random leaf of the primary-key btree — page splits and poor index locality.

**PostgreSQL 18** ships `uuidv7()`, which is time-ordered and gives sequential
insert locality with no schema change to the app (still a UUID string).

### Migration

```sql
ALTER TABLE webhook_requests ALTER COLUMN id SET DEFAULT uuidv7();
```

No table rewrite, no lock beyond a brief `ACCESS EXCLUSIVE`, existing v4 rows
stay valid.

### schema.sql

```sql
id UUID PRIMARY KEY DEFAULT uuidv7(),
```

### Compatibility

Requires PostgreSQL ≥ 18 (the live database is 18.6). If any environment still
runs < 18, either keep `gen_random_uuid()` there or provide a UUIDv7 SQL
function; do not set a default the server cannot resolve.

### Verify

```sql
INSERT INTO webhook_requests (payload) VALUES ('{}') RETURNING id;  -- version nibble 7
SELECT substring(id::text, 15, 1) AS version_digit FROM webhook_requests ORDER BY created_at DESC LIMIT 3;
```

Consider `REINDEX INDEX CONCURRENTLY webhook_requests_pkey;` once after v7 rows
accumulate, to compact the v4-era fragmentation.

---

## A. `SERIAL` (`int4`) primary keys → `bigint`

**Current:** 13 tables use `id SERIAL PRIMARY KEY` (`int4`, ceiling 2,147,483,647).

### Inventory — parent PKs and the columns that reference them

`users.id` is referenced by (all must change together):

| child                       | column        | FK constraint                                  |
| --------------------------- | ------------- | ---------------------------------------------- |
| messages                    | sender_id     | messages_sender_id_fkey                        |
| lists                       | user_id       | lists_user_id_fkey                             |
| appointments                | user_id       | appointments_user_id_fkey                      |
| appointtypes                | user_id       | appointtypes_user_id_fkey                      |
| audit_logs                  | admin_user_id | audit_logs_admin_user_id_fkey                  |
| uploads                     | uploaded_by   | uploads_uploaded_by_fkey                       |
| api_tokens                  | user_id       | api_tokens_user_id_fkey                        |
| admin_active_runs           | admin_user_id | admin_active_runs_admin_user_id_fkey           |
| chat_runs                   | user_id       | chat_runs_user_id_fkey                         |
| chat_pending_gates          | user_id       | chat_pending_gates_user_id_fkey                |
| support_agent_pending_gates | admin_user_id | support_agent_pending_gates_admin_user_id_fkey |

`resources.id` is referenced by `appointments.resource_id`,
`appointoffering.resource_id`, `offering_configs.resource_id`.
`appointments.id` is referenced by `notifications.appointment_id`.

Standalone PKs (no children): `messages`, `clients`, `lists`, `notifications`,
`appointtypes`, `appointoffering`, `offering_configs`, `audit_logs`, `uploads`,
`api_tokens`.

### Strategy A1 — coordinated `ALTER` in a maintenance window (recommended now)

At the current size (a few hundred rows; `uploads` is 83 rows / 65 MB of BYTEA)
a locked rewrite is seconds. `ALTER COLUMN ... TYPE bigint` requires a table
rewrite and takes `ACCESS EXCLUSIVE`; the referencing FKs must be dropped first
and recreated after.

**Worked example — `users.id` and its eleven children:**

```sql
BEGIN;

-- 1) Drop the FKs that reference users.id
ALTER TABLE messages                    DROP CONSTRAINT messages_sender_id_fkey;
ALTER TABLE lists                       DROP CONSTRAINT lists_user_id_fkey;
ALTER TABLE appointments                DROP CONSTRAINT appointments_user_id_fkey;
ALTER TABLE appointtypes                DROP CONSTRAINT appointtypes_user_id_fkey;
ALTER TABLE audit_logs                  DROP CONSTRAINT audit_logs_admin_user_id_fkey;
ALTER TABLE uploads                     DROP CONSTRAINT uploads_uploaded_by_fkey;
ALTER TABLE api_tokens                  DROP CONSTRAINT api_tokens_user_id_fkey;
ALTER TABLE admin_active_runs           DROP CONSTRAINT admin_active_runs_admin_user_id_fkey;
ALTER TABLE chat_runs                   DROP CONSTRAINT chat_runs_user_id_fkey;
ALTER TABLE chat_pending_gates          DROP CONSTRAINT chat_pending_gates_user_id_fkey;
ALTER TABLE support_agent_pending_gates DROP CONSTRAINT support_agent_pending_gates_admin_user_id_fkey;

-- 2) Widen the parent and every referencing column
ALTER TABLE users        ALTER COLUMN id TYPE bigint;
ALTER TABLE messages     ALTER COLUMN sender_id TYPE bigint;
ALTER TABLE lists        ALTER COLUMN user_id TYPE bigint;
ALTER TABLE appointments ALTER COLUMN user_id TYPE bigint;
ALTER TABLE appointtypes ALTER COLUMN user_id TYPE bigint;
ALTER TABLE audit_logs   ALTER COLUMN admin_user_id TYPE bigint;
ALTER TABLE uploads      ALTER COLUMN uploaded_by TYPE bigint;
ALTER TABLE api_tokens   ALTER COLUMN user_id TYPE bigint;
ALTER TABLE admin_active_runs           ALTER COLUMN admin_user_id TYPE bigint;
ALTER TABLE chat_runs                   ALTER COLUMN user_id TYPE bigint;
ALTER TABLE chat_pending_gates          ALTER COLUMN user_id TYPE bigint;
ALTER TABLE support_agent_pending_gates ALTER COLUMN admin_user_id TYPE bigint;

-- 3) A SERIAL sequence stays int4 after the column widens; widen it explicitly
ALTER SEQUENCE users_id_seq AS bigint;

-- 4) Recreate the FKs with their original actions
ALTER TABLE messages    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE lists       ADD CONSTRAINT lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE appointments ADD CONSTRAINT appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE appointtypes ADD CONSTRAINT appointtypes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE audit_logs  ADD CONSTRAINT audit_logs_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE uploads     ADD CONSTRAINT uploads_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE api_tokens  ADD CONSTRAINT api_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE admin_active_runs ADD CONSTRAINT admin_active_runs_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE chat_runs   ADD CONSTRAINT chat_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE chat_pending_gates ADD CONSTRAINT chat_pending_gates_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE support_agent_pending_gates ADD CONSTRAINT support_agent_pending_gates_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE;

COMMIT;
```

**Then the same pattern for `resources.id`:**

```sql
BEGIN;
ALTER TABLE appointments     DROP CONSTRAINT appointments_resource_id_fkey;
ALTER TABLE appointoffering  DROP CONSTRAINT appointoffering_resource_id_fkey;
ALTER TABLE offering_configs DROP CONSTRAINT offering_configs_resource_id_fkey;

ALTER TABLE resources        ALTER COLUMN id TYPE bigint;
ALTER TABLE appointments     ALTER COLUMN resource_id TYPE bigint;
ALTER TABLE appointoffering  ALTER COLUMN resource_id TYPE bigint;
ALTER TABLE offering_configs ALTER COLUMN resource_id TYPE bigint;
ALTER SEQUENCE resources_id_seq AS bigint;

ALTER TABLE appointments     ADD CONSTRAINT appointments_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE RESTRICT;
ALTER TABLE appointoffering  ADD CONSTRAINT appointoffering_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE RESTRICT;
ALTER TABLE offering_configs ADD CONSTRAINT offering_configs_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE;
COMMIT;
```

**And `appointments.id`:**

```sql
BEGIN;
ALTER TABLE notifications DROP CONSTRAINT notifications_appointment_id_fkey;
ALTER TABLE appointments  ALTER COLUMN id TYPE bigint;
ALTER TABLE notifications ALTER COLUMN appointment_id TYPE bigint;
ALTER SEQUENCE appointments_id_seq AS bigint;
ALTER TABLE notifications ADD CONSTRAINT notifications_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;
COMMIT;
```

**Standalone PKs** (repeat per table; no FK work):

```sql
BEGIN;
ALTER TABLE messages ALTER COLUMN id TYPE bigint;
ALTER SEQUENCE messages_id_seq AS bigint;
COMMIT;
-- clients, lists, notifications, appointtypes, appointoffering,
-- offering_configs, audit_logs, uploads, api_tokens identically
```

> The live sequence names are all `<table>_id_seq` (verified against the catalog).
> If a table is skipped, no child needs changing.

### Strategy A2 — expand/contract (use only if the database is large)

If a locked rewrite is not acceptable when the time comes:

1. Add `id_new bigint GENERATED BY DEFAULT AS IDENTITY` to the parent; backfill
   `id_new = id`.
2. Add `<ref>_new bigint` to each child; backfill from the parent.
3. Dual-write in the app (write both old and new) and keep reading the old.
4. Add `NOT NULL` + the new FK (`NOT VALID`, then `VALIDATE CONSTRAINT`).
5. In a short window, drop the old FKs/defaults, rename `_new` columns into place,
   rebuild the PK, and `ALTER COLUMN ... SET GENERATED ALWAYS`.
6. Drop the old columns; remove the dual-write code.

### App-side changes (both strategies)

- [`app/data/schema.ts`](app/data/schema.ts): change `id` and every FK column
  listed above from `c.integer()` to the existing `bigint()` /
  `bigintNullable()` helper ([`#L9-L15`](app/data/schema.ts#L9)). Add those
  fields to each table's `afterRead` `parseIntFields(...)` call, because
  node-postgres returns `int8` as a string and the helper's
  `ColumnBuilder<number>` type does not convert by itself
  ([`app/utils/schema-utils.ts:6`](app/utils/schema-utils.ts#L6)).
- Raw-SQL array casts must widen from `int`/`integer` to `bigint`:
  - [`app/data/uploads.ts`](app/data/uploads.ts) — `::int[]` at lines 315, 332,
    339, 389, 393, 430, 431.
  - [`app/data/appointment.ts:16`](app/data/appointment.ts#L16) — `::int[]`.
  - [`app/data/lists.ts:294-L295`](app/data/lists.ts#L294) — `::integer[]` twice.
  - Leave `COUNT(*)::int` and other aggregate casts alone; they do not carry IDs.
- TypeScript input/output types stay `number`; `parseIntFields` keeps them
  numbers. No controller signature changes if the `afterRead` hooks are updated.

### schema.sql (fresh databases)

For new tables prefer `id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY`
(identity over `SERIAL`; `BY DEFAULT` keeps explicit-id inserts in tests
working). Convert the existing definitions in the same commit that adds the
manual migration.

### Verify

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('id','user_id','resource_id','sender_id','appointment_id','uploaded_by','admin_user_id')
  AND table_name IN ('users','messages','lists','appointments','appointtypes','audit_logs','uploads','api_tokens','admin_active_runs','chat_runs','chat_pending_gates','support_agent_pending_gates','resources','notifications','appointoffering','offering_configs')
ORDER BY table_name, column_name;   -- every row must read 'bigint'
```

Then boot the app and run the full server test suite (step 0.5).

### Rollback

Inverse DDL (drop FKs, `ALTER COLUMN ... TYPE integer`, recreate FKs), safe while
every value is < 2^31. Restore from the dump if anything was already dropped.

---

## B. epoch-`BIGINT` timestamps → `timestamptz`

**Current:** all time columns are epoch milliseconds in `bigint`:
`users.created_at`, `updated_at`, `verification_expires`,
`password_reset_expires`, `disabled_at`; `appointments.date`;
`appointoffering.day`; and `*_created_at` / `*_updated_at` on every table.
The app writes `Date.now()` and reads `Number(...)`.

**This is an intentional, consistent convention.** Migrating is high-churn for no
correctness gain until a concrete need appears (timezone-correct reporting,
`date_trunc`/interval analytics, or declarative time partitioning). **Default
recommendation: defer.** If the need arrives, convert per table with
expand/contract — never a big-bang.

### Pattern (worked example: `users.created_at`)

```sql
-- 1) Add the new column and backfill from epoch ms
ALTER TABLE users ADD COLUMN created_at_ts timestamptz;
UPDATE users SET created_at_ts = to_timestamp(created_at / 1000.0);
ALTER TABLE users ALTER COLUMN created_at_ts SET NOT NULL;

-- 2) Ship app dual-write: keep writing created_at (ms) AND created_at_ts
--    (to_timestamp(ms/1000.0)); reads still use created_at.

-- 3) After the dual-write is verified, swap
BEGIN;
ALTER TABLE users DROP COLUMN created_at;
ALTER TABLE users RENAME COLUMN created_at_ts TO created_at;
COMMIT;

-- 4) Recreate/rename any index on the column (a DROP COLUMN drops its index)
CREATE INDEX users_created_at_idx ON users (created_at);
```

Repeat for `updated_at`, then per table. Columns with indexes to recreate:
`appointments.date` (`appointments_date_idx`, `appointments_user_date_idx`,
`appointments_resource_date_idx`), `appointoffering.day`
(`appointoffering_day_idx`, `appointoffering_resource_day_idx`),
`webhook_requests.created_at`, `uploads.created_at`, `audit_logs.created_at`,
`chat_runs.created_at`, `notifications.created_at`, `lists.created_at`,
`lists.updated_at`.

### App-side changes

- Every write site must dual-write (or switch to `new Date(ms)`), and every
  read site switches from `Number(row.created_at)` to a `Date`/ISO value. Grep
  for `Date.now()` (write) and `Number(.*_at)` (read) to size the change.
- The data-table column type changes from `bigint()` to a timestamp column, and
  `afterRead` no longer needs `parseIntFields` for those fields.
- Response/JSON shapes change (epoch number → ISO string) — audit the client
  entries and SSE payloads that format timestamps.

### Verify

Spot-check a handful of rows against the old values captured before the swap:

```sql
SELECT id, created_at, to_timestamp(created_at / 1000.0) FROM users LIMIT 5;
```

and confirm timezone rendering in the UI.

### Rollback

Keep the old `bigint` columns until step 3 is verified; before the `DROP`,
rollback is dropping the `_ts` columns and the dual-write code.

---

## Remaining finding status (for context)

Fixed on 2026-09-24 (migration `2026-09-24-db-review-fixes.sql`): redundant
`api_tokens` index dropped; `chat_runs.created_at`, webhook payload trigram, and
`lists.updated_at` indexes added; messages `LEFT JOIN`; upload quota lock.

Not pursued, with reasons: JSONB item search and systemic `OFFSET` pagination
(performance-only at current scale); RLS (app-layer scoping is already
consistent; defense-in-depth only); upload retention ownership semantics (needs
a product decision). `users_email_trgm_idx` is **live** — it backs the email
`ILIKE` search in [`app/actions/admin/users/controller.tsx:109`](app/actions/admin/users/controller.tsx#L109)
and [`app/actions/agent-events/handlers/resolve.ts:18`](app/actions/agent-events/handlers/resolve.ts#L18),
so it was intentionally **kept**.
