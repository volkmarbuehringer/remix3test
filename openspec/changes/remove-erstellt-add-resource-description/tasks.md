## 1. Offerings Grid

- [ ] 1.1 In `admin-offerings-page.tsx`: remove "Erstellt" `<th>` header (lines 335-343)
- [ ] 1.2 In `admin-offerings-page.tsx`: remove created_at `<td>` data cell (line 366)
- [ ] 1.3 In `admin-offerings-page.tsx`: split "Ressource" `<th>` into "Ressource" (name, sortable on `r.description`) and "Beschreibung" (not sortable)
- [ ] 1.4 In `admin-offerings-page.tsx`: update the data `<td>` for Ressource to show only `resource_name`, and add a new `<td>` for Beschreibung showing `resource_description`
- [ ] 1.5 In `admin-offerings-page.tsx`: update `<colgroup>` to remove one column (8 → 7 columns)

## 2. Appointments Grid

- [ ] 2.1 In `admin-appointments-page.tsx`: remove "Erstellt" `<th>` header (lines 341-354)
- [ ] 2.2 In `admin-appointments-page.tsx`: remove created_at `<td>` data cell (line 392-394)
- [ ] 2.3 In `admin-appointments-page.tsx`: split "Ressource" `<th>` into "Ressource" (name, sortable on `r.description`) and "Beschreibung" (not sortable)
- [ ] 2.4 In `admin-appointments-page.tsx`: update the data `<td>` for Ressource to show only `resource_name`, and add a new `<td>` for Beschreibung showing `resource_description`
- [ ] 2.5 In `admin-appointments-page.tsx`: update `<colgroup>` to remove one column (8 → 7 columns)

## 3. Offering-Configs Grid + Context Menu

- [ ] 3.1 In `admin-offering-configs-page.tsx`: remove "Erstellt" `<th>` header (lines 243-251)
- [ ] 3.2 In `admin-offering-configs-page.tsx`: remove created_at `<td>` data cell (line 270)
- [ ] 3.3 In `admin-offering-configs-page.tsx`: split "Ressource" `<th>` into "Ressource" (name, sortable on `resource_description`) and "Beschreibung" (not sortable)
- [ ] 3.4 In `admin-offering-configs-page.tsx`: remove the action `<th>` column header (line 261) and the action `<td>` cell with edit/delete buttons (lines 272-300)
- [ ] 3.5 In `admin-offering-configs-page.tsx`: add hidden delete forms per row (matching offerings/appointments pattern) with `data-delete-form={row.id}` for context menu
- [ ] 3.6 In `admin-offering-configs-page.tsx`: add `data-offering-configs-table` attribute to the table wrapper div for the context menu delegation
- [ ] 3.7 In `admin-offering-configs-page.tsx`: add a `<script id="offering-configs-grid-state">` JSON block with grid state for the context menu
- [ ] 3.8 In `admin-offering-configs-page.tsx`: update `<colgroup>` to remove two columns (6 → 4 columns)
- [ ] 3.9 Create `app/assets/admin-offering-configs-context-menu.tsx` as a new clientEntry component (modeled on `admin-offerings-context-menu.tsx`)
- [ ] 3.10 Wire the context menu component into `admin-offering-configs-page.tsx`

## 4. Verify

- [ ] 4.1 Run `npm run typecheck` to confirm no TypeScript errors
- [ ] 4.2 Run `npm test` to confirm existing tests still pass
- [ ] 4.3 Run `npm run start` and manually verify all three grids render correctly
