## 1. Schema & Data Setup

- [x] 1.1 Add `offering_configs` table definition to `app/data/schema.ts`
- [x] 1.2 Add `CREATE TABLE IF NOT EXISTS offering_configs` to `app/data/setup.ts` with UNIQUE constraint on resource_id and FK to resources
- [x] 1.3 Export `OfferingConfig` type and `offering_configs` table from schema

## 2. Config Data Module

- [x] 2.1 Create `app/data/offering-configs.ts` with `getConfig(db, resourceId)` function
- [x] 2.2 Add `upsertConfig(pool, resourceId, rules)` function (INSERT ON CONFLICT UPDATE)
- [x] 2.3 Add `generateWeek(pool, resourceId, year, week)` function that reads config, iterates days, skips holidays, and inserts offerings
- [x] 2.4 Add `previewWeek(pool, resourceId, year, week)` function returning `{day, dateStr, startMin, endMin, isHoliday, exists}` for preview display

## 3. Controller — Config Actions

- [x] 3.1 Add `POST /admin/offerings/config` action in `admin-offerings-controller.tsx` — receives `resource_id`, builds rules from form fields, upserts config, redirects
- [x] 3.2 Add `POST /admin/offerings/week` action — receives `resource_id`, `year`, `week`, calls `generateWeek`, redirects with result feedback

## 4. Controller — Index Updates

- [x] 4.1 Read `?config` and `?addweek` URL params in the `index` action, pass them to `AdminOfferingsPage`
- [x] 4.2 Pass `offeringConfigs` data to the page when config editing is requested
- [x] 4.3 Pass preview data to the page when addweek is selected and resource/year/week params are present

## 5. UI — Config Form

- [x] 5.1 Create `AdminOfferingsConfigPage` component with resource selector and 7 day rows (checkbox + start time + end time)
- [x] 5.2 Wire the config form to POST `/admin/offerings/config`
- [x] 5.3 Add the config form to the two-column sidebar layout in `AdminOfferingsPage`

## 6. UI — Add Week Form

- [x] 6.1 Create `AdminOfferingsWeekPage` component with resource, year, week dropdowns and a preview section
- [x] 6.2 Add preview rendering showing day-by-day output with holiday indicators
- [x] 6.3 Wire the form to POST `/admin/offerings/week`
- [x] 6.4 Add "Add Week" button to the offerings grid toolbar
- [x] 6.5 Add the week form to the two-column sidebar layout

## 7. Integration & Cleanup

- [x] 7.1 Register new routes in `app/routes.ts` — added `configSave` and `weekGenerate` routes
- [x] 7.2 Typecheck passes
