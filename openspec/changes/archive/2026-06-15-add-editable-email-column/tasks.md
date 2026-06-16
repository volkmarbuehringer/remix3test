## 1. Controller: accept partial JSON updates

- [x] 1.1 Detect `Content-Type: application/json` in `update` action and parse body with `s.parseSafe` for email-only schema
- [x] 1.2 Return JSON `{ ok: true }` on success or `{ ok: false, error }` on validation failure
- [x] 1.3 Update existing form-data path to remain unchanged

## 2. Grid page: wire inline edit state + new clientEntry

- [x] 2.1 Add `<script id="client-grid-state" type="application/json">` to grid-page.tsx with csrf token
- [x] 2.2 Add `data-inline-edit="email"` attribute to the email `<td>` elements and `data-row-id` to `<tr>`
- [x] 2.3 Import and render `<ClientGridInlineEdit />` in the grid page component

## 3. New clientEntry: ClientGridInlineEdit

- [x] 3.1 Create `app/assets/client-grid-inline-edit.tsx` with `clientEntry` wrapping a single setup scope
- [x] 3.2 Delegate click events on `[data-inline-edit]` cells via table container listener
- [x] 3.3 On click: replace cell text with `<input>`, track row id and original value
- [x] 3.4 Input replaces cell text content, styled to match table
- [x] 3.5 Save on Enter / blur: `fetch PUT /client/:id` with JSON email + CSRF header
- [x] 3.6 Cancel on Escape: revert cell to original text
- [x] 3.7 On save success: call `handle.frame.reload()` to refresh grid
- [x] 3.8 Show inline error below input on 400 response, keep input focused

## 4. Verify

- [x] 4.1 Run `npm run typecheck` — passed
- [x] 4.2 Run tests: `npx remix test app/actions/client/` — 22/22 pass (pre-existing directory import issue on wildcard runner)
- [ ] 4.3 Manual smoke test: click email → edit → Enter → grid reloads with new value
