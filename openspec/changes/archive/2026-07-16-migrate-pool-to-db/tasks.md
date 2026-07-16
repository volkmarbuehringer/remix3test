## 1. Migrate `support-tools.ts`

- [x] 1.1 Import `db` from `../../../data/connection.ts`; keep `pool` import for the 3 queries that must stay raw
- [x] 1.2 Replace `lookupUser` — `pool.connect()` → `db.findOne(users, { where: or(eq('id', id), eq('email', email)) })` or `db.find(users, id)` for numeric
- [x] 1.3 Replace `listRecentAppointments` — `pool.connect()` → `db.query(appointments).leftJoin(users, ...).where(...).orderBy('created_at', 'desc').limit(limit).select(...).all()`
- [x] 1.4 Replace `countUsers` — `pool.connect()` → `db.exec(sql\`SELECT role, count(*)::int AS count FROM users ...\`)` (must stay raw — GROUP BY with computed alias)
- [x] 1.5 Replace `getResourceDetails` — `pool.connect()` → `db.findOne(resources, { where: or(eq('id', id), eq('name', name)) })`
- [x] 1.6 Replace `getOfferingsForDate` — `pool.connect()` → `db.query(appointofferings).leftJoin(resources, ...).where({ day }).orderBy('during', 'asc').all()`
- [x] 1.7 Replace `searchAppointmentsByDateRange` — `pool.connect()` → query builder chain
- [x] 1.8 Replace `getUserAppointments` — `pool.connect()` → query builder chain
- [x] 1.9 Replace `getAppointmentDetails` — `pool.connect()` → query builder chain
- [x] 1.10 Replace `getOfferingConfigForResource` — `pool.connect()` → `db.findOne(offeringConfigs, { where: { resource_id } })`
- [x] 1.11 Replace `getAppointTypes` — `pool.connect()` → `db.findMany(appointtypes, { orderBy: [['title', 'asc']] })`
- [x] 1.12 Replace `searchMessages` — `pool.connect()` → query builder with `ilike()` operator
- [x] 1.13 Replace `getAdminStats` — simple counts → `db.count()`; role GROUP BY → `db.exec(sql\`...\`)`
- [x] 1.14 Replace `generatePdfReport` (appointment-list, user-list) — query builder + `db.findMany()`
- [x] 1.15 Replace `cancelUserAccount` — `pool.connect()` → `db.find(users, id)`
- [x] 1.16 Replace `lockUserAccount` — `pool.connect()` → `db.find()` + `db.update()`
- [x] 1.17 Replace `unlockUserAccount` — `pool.connect()` → `db.find()` for SELECT; UPDATE stays as `db.exec(sql\`...\`)` (self-referencing `token_version + 1`)

## 2. Migrate `customer-tools.ts`

- [x] 2.1 Import `db` from `../../../data/connection.ts`; keep `pool` import for `searchResourcesByCapability`
- [x] 2.2 Replace `findNextAvailableSlots` — `pool.connect()` → query builder with `where(gte(...))`, `where(lt(...))`, `orderBy`
- [x] 2.3 Keep `searchResourcesByCapability` as `db.exec(sql\`...\`)` — computed rank with dynamic ILIKE chain is not expressible via builder
- [x] 2.4 Replace `listMyAppointments` — `pool.connect()` → query builder with JOIN
- [x] 2.5 Replace `cancelAllAppointments` — `pool.connect()` → query builder with JOIN

## 3. Migrate `route-find-list.ts`

- [x] 3.1 Import `db` instead of `pool`; keep `pool` for `searchResourcesByCapability`-style queries
- [x] 3.2 Replace simple list queries with `db.findMany()` where applicable
- [x] 3.3 Keep `jsonb_array_elements` + `EXISTS` subquery as `db.exec(sql\`...\`)`

## 4. Migrate `booking-reminder-workflow.ts`

- [x] 4.1 Import `db` from `../../../data/connection.ts`; remove `pool` import
- [x] 4.2 Replace `queryUpcomingAppointments` — `pool.connect()` → query builder with leftJoin; handle `COALESCE` via JS (`?? 'Unknown'`)
- [x] 4.3 Replace `sendReminders` existence check — `pool.connect()` → `db.query(appointments).where({ id }).exists()`

## 5. Migrate `customer-booking-workflow.ts`

- [x] 5.1 Remove unused `pool` import (this file already imports `db`)
- [x] 5.2 Replace raw `pool.connect()` fallback in `findAvailableSlotsStep` → query builder
- [x] 5.3 Replace `createAppointmentRecord` raw INSERT → `db.create(appointments, values, { returnRow: true })`

## 6. Verify

- [x] 6.1 Run `pnpm typecheck` — must pass with zero errors
- [x] 6.2 Run `pnpm test` — must match pre-migration results (483 pass / 40 pre-existing Mastra PG failures)
- [x] 6.3 Run `pnpm lint` — must pass with zero warnings
