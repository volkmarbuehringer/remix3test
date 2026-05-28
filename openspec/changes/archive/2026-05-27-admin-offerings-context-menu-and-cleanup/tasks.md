## 1. Add context menu to admin offerings page

- [x] 1.1 Create `app/assets/admin-offerings-context-menu.tsx` following the exact `admin-appointments-context-menu.tsx` pattern (hidden trigger with `opacity:0`, event delegation on table container)
- [x] 1.2 Add `data-offerings-table="true"` attribute to the offerings table wrapper div in `admin-offerings-page.tsx`
- [x] 1.3 Add `data-delete-form={row.id}` attribute to the RestfulForm in each offerings table row
- [x] 1.4 Add a `<script id="offerings-grid-state" type="application/json">` with the grid state JSON before the clientEntry
- [x] 1.5 Import and render `<AdminOfferingsContextMenu />` in the offerings page template

## 2. Remove action buttons from admin appointments page

- [x] 2.1 Remove the action cell `<td>` with the `btnGroupStyle` div (Edit link + Delete RestfulForm) from each row in `admin-appointments-page.tsx`
- [x] 2.2 Remove the unused CSS mixins: `actionCellStyle`, `btnGroupStyle`, `editBtnStyle`, `delBtnStyle`
- [x] 2.3 Adjust the `colgroup` — remove the last `<col style={{ width: '100px' }}>` (was the action column)
- [x] 2.4 Remove the action column header `<th>` (last header with empty content and `width: 100px`)

## 3. Verify and typecheck

- [x] 3.1 Run typecheck: `pnpm run typecheck`
- [ ] 3.2 Verify offerings right-click → Edit/Delete works
- [ ] 3.3 Verify appointments right-click → Edit/Delete still works (regression check)
- [ ] 3.4 Verify offerings table is not broken (columns, pagination, inline editing)
- [ ] 3.5 Verify appointments table columns are properly redistributed (no gap where actions were)
