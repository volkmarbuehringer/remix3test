## 1. Data Layer

- [x] 1.1 Add `appointtypes` table definition to `app/data/schema.ts` with columns: id, user_id, title, created_at, updated_at; export `AppointType` type
- [x] 1.2 Add `appointtypes` CREATE TABLE to `app/data/setup.ts` with foreign key to users and indexes
- [x] 1.3 Create `app/data/appointtypes.ts` with CRUD operations: listAppointTypes, createAppointType, updateAppointType, deleteAppointType

## 2. Routes & Controller

- [x] 2.1 Add `types` route tree to `appointmentRoutes` in `app/routes.ts` (index, create, update, destroy); add `appointTypes` frame target constant
- [x] 2.2 Create `app/actions/appointtype-controller.tsx` with actions: index (list user's types, order alphabetical), create, update, destroy — all with `requireAuth()` and JSON responses
- [x] 2.3 Wire appointtype controller in `app/router.ts` via `router.map()`

## 3. Types Panel UI

- [x] 3.1 Create `app/lib/appointtype-drag.ts` — shared module exporting `typeDragState` (nullable `{ active: boolean, title: string }`)
- [x] 3.2 Create `app/ui/appointtype-panel.tsx` — client entry showing alphabetical list of types, inline add input, inline rename (click-to-edit), context menu (Bearbeiten/Löschen)
- [x] 3.3 Implement inline add: [+ Add Type] button → new row with focused input → Enter POSTs, Escape cancels
- [x] 3.4 Implement inline rename: click title → becomes `<input>` → Enter/blur PUTs, Escape reverts
- [x] 3.5 Implement context menu: right-click → menu.Context with MenuList (Bearbeiten, Löschen) — Löschen confirms then DELETEs
- [x] 3.6 Implement drag initiation: each type item has `pointerdown` → sets `typeDragState`, `pointerup` → clears

## 4. Layout & Page Integration

- [x] 4.1 Update `app/ui/appointment-page.tsx` — wrap sidebar column in a flex div, add `<Frame name={frames.appointTypes} src="/appointment/types" />` below the sidebar

## 5. Grid Drop Zone

- [x] 5.1 Add drop handling to `app/ui/appointment-grid.tsx` — check `typeDragState` in `onWindowPointerMove`, show ghost block (60 min) at snapped position when hovering grid
- [x] 5.2 Implement drop commit in `appointment-grid.tsx` — on `pointerup` with `typeDragState.active`, POST `/appointment` with `{ typeId, date, start_min }`; fall back to INSERT...SELECT on server
- [x] 5.3 Update appointment controller `create` action to accept `typeId` parameter and perform INSERT...SELECT when present

## 6. Verification

- [x] 6.1 Run typecheck (`npm run typecheck`)
- [x] 6.2 Run tests (`npm test`)
- [x] 6.3 Manual smoke test: add a type, verify it appears, drag it to calendar, verify appointment created
