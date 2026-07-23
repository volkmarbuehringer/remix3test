# Code Deletion Log

## [2026-07-23] Refactor Session — Dead Code Cleanup

### Unused CSS Removed from `app/ui/layout.tsx`
Removed 19 unused CSS style constants that were never referenced in JSX templates or exported:

- `logoutFormStyle` — leftover from old header nav
- `logoutIconStyle` — leftover from old header nav
- `headerStyle` — replaced by `main-nav.tsx`'s own styles
- `containerStyle` — replaced by `main-nav.tsx`'s own styles
- `navStyle` — moved to `sidebar-layout.tsx` and `main-nav.tsx`
- `navSectionGroupCss` — moved to `main-nav.tsx`
- `navSectionLabelCss` — moved to `main-nav.tsx`
- `brandGroupCss` — replaced by `main-nav.tsx`'s own styles
- `logoStyle` — replaced by `main-nav.tsx`'s own styles
- `userEmailCss` — replaced by new user menu pattern
- `navLinkStyle` — moved to `sidebar-layout.tsx` and `main-nav.tsx`
- `navActiveStyle` — moved to `sidebar-layout.tsx` and `main-nav.tsx`
- `showcaseGroupStyle` — from iterative showcase dropdown (unused)
- `showcaseButtonStyle` — from iterative showcase dropdown (unused)
- `chevronStyle` — from iterative showcase dropdown (unused)
- `showcaseMenuStyle` — from iterative showcase dropdown (unused)
- `dropdownLinkStyle` — from iterative showcase dropdown (unused)
- `dropdownActiveStyle` — from iterative showcase dropdown (unused)
- `themeToggleStyle` — replaced by `main-nav.tsx`'s own toggle

File reduced from 350 lines to 157 lines.

### Seed Bug Fixed in `app/data/seed.ts`
- **Line 125:** Changed `res.description === 'resource2'` to `res.name === 'Raum 2'`
- **Reason:** The seed creates resources named "Raum 1" and "Raum 2" with German descriptions ("Hauptraum mit Beamer und Whiteboard", "Nebenraum für Kleingruppen"). The original condition checked `description === 'resource2'` which never matched, so all resources got the same default rules (Mon/Wed). Now "Raum 2" correctly gets Tue/Thu rules as intended.

### Duplicate `insertWebhookRequest` Consolidated
- **`app/data/webhook.ts`** — DELETED (16 lines)
- **`app/data/webhook-requests.ts`** — Updated `insertWebhookRequest` to return `Promise<string>` (ID) using `RETURNING id`, matching the signature previously in `webhook.ts`
- **`app/actions/webhook/controller.tsx`** — Updated import from `../../data/webhook.ts` to `../../data/webhook-requests.ts`, changed parameter key from `serialized` to `payload` to match the canonical API
- **Test impact:** `webhook-requests.test.ts` already imports from the canonical `webhook-requests.ts`; changing return type from `void` to `string` is backward-compatible (callers use `await` without storing result)

### Impact Summary
- Files deleted: 1
- Lines of code removed: ~210
- Tests passing: 1005 / 1006 (1 preexisting failure: AI API key configuration)
- File size reduction: `layout.tsx` 350 → 157 lines
