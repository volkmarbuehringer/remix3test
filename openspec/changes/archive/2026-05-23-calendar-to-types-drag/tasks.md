## 1. Shared State

- [x] 1.1 Add `panelDropActive` flag to `app/lib/appointtype-drag.ts` — exported getter/setter for whether a grid-drogged block is hovering over the types panel

## 2. Grid Drag Extension

- [x] 2.1 Add `isOverTypesPanel` detection in `app/ui/appointment-grid.tsx` — in `moveDrag()`, check pointer position against the types panel DOM element (via `[data-types-panel]` attribute); update shared `panelDropActive` flag
- [x] 2.2 Add types panel drop handling in `endDrag()` — if `isOverTypesPanel`, POST `/appointment/types` with `{ title: appt.title }` and skip normal position save; reload Frame on success

## 3. Types Panel Drop Zone

- [x] 3.1 Add `data-types-panel` attribute to the panel container in `app/ui/appointtype-panel.tsx`
- [x] 3.2 Add drop zone visual feedback in `appointtype-panel.tsx` — read `panelDropActive` from shared state, apply highlighted border style when active

## 4. Verification

- [x] 4.1 Run typecheck (`npm run typecheck`)
- [x] 4.2 Run tests (`npm test`)
- [ ] 4.3 Manual smoke test: drag an appointment block onto types panel, verify type is created, appointment stays in place
