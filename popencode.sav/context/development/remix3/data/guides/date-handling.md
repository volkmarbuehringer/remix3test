<!-- Context: development/remix3/data/guides/date-handling | Priority: high | Version: 1.0 | Updated: 2026-05-26 -->

# Date Handling Patterns

**Purpose**: Authoritative reference for date formatting in this German appointment scheduling app. All server-side date display now uses `Intl` API with hardcoded `'de-DE'` locale.

## Formatting Standard

Use the `Intl` API (`toLocaleString` / `toLocaleDateString` / `toLocaleTimeString`) with explicit `'de-DE'` locale. **No manual formatting** (no `getDate()`, `getMonth()+1`, `padStart()`).

### Date-only
```typescript
new Date(ts).toLocaleDateString('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
// → "25.05.2026"
```

### Datetime
```typescript
new Date(ts).toLocaleString('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
// → "25.05.2026, 22:13"
```

### Time-only
```typescript
new Date(ts).toLocaleTimeString('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
})
// → "22:13"
```

### Quick reference table

| Pattern | Function | Options |
|---------|----------|---------|
| Date | `toLocaleDateString('de-DE', ...)` | `{ day:'2-digit', month:'2-digit', year:'numeric' }` |
| Datetime | `toLocaleString('de-DE', ...)` | `{ day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }` |
| Time | `toLocaleTimeString('de-DE', ...)` | `{ hour:'2-digit', minute:'2-digit' }` |

When using `.toLocaleString()` for datetime, the result always includes a comma separator: `"25.05.2026, 22:13"`. To remove the comma, format date and time separately and concatenate.

## Files Updated

### Commit `d727339` — locale changes
| File | Change |
|------|--------|
| `app/ui/document.tsx` | `lang="en"` → `lang="de"` |
| `app/actions/client/create-page.tsx` | Registered field: `type="text"` → `type="date"` |
| `app/actions/client/edit-page.tsx` | Registered field: `type="text"` → `type="date"` |
| `app/actions/client/grid-page.tsx` | `formatDate` → `toLocaleDateString('de-DE', ...)` |

### Commit `ee7d453` — datum
`app/ui/admin-offerings-page.tsx` — `formatDate` and `formatTimestamp` replaced with `'de-DE'` variants.

### Commit `a71c597` — datum formatting
| File | Lines | Change |
|------|-------|--------|
| `app/ui/admin-offerings-page.tsx` | 88–100 | `formatDate` / `formatTimestamp` → `'de-DE'` with explicit options |
| `app/ui/admin-messages-page.tsx` | 27 | `.toLocaleString()` → `.toLocaleString('de-DE')` |
| `app/ui/admin-nutzer-page.tsx` | 91 | Was already correct with `'de-DE'` |
| `app/ui/admin-chatlog-page.tsx` | 142, 167 | `.toLocaleString()` → `.toLocaleString('de-DE')` |
| `app/ui/admin-fragments/chatlog-detail-fragment.tsx` | 133 | `.toLocaleTimeString()` → `.toLocaleTimeString('de-DE', ...)` |
| `app/ui/workflow-page.tsx` | 282 | `.toLocaleString()` → `.toLocaleString('de-DE')` |
| `app/ui/workflow-run-page.tsx` | 110, 112 | `.toLocaleString()` → `.toLocaleString('de-DE')` |
| `app/actions/ai-fragments-controller.tsx` | 27 | `.toLocaleTimeString()` → `.toLocaleTimeString('de-DE', ...)` |
| `app/actions/admin-fragments-controller.tsx` | 33–34 | `.toLocaleTimeString/DateString()` → `'de-DE'` variants |

## Client Form Updates

The `registered` field on client create/edit forms was changed from a text input with placeholder to `type="date"`:

**Before**: `<input type="text" placeholder="TT.MM.JJJJ" />`
**After**: `<input type="date" name="registered" />`

The server-side `parseDate()` in `app/actions/client/controller.tsx` (line 46–49) already handles ISO format from `type="date"` correctly:

```typescript
function parseDate(value: string): number {
  let ts = new Date(value).getTime()
  return Number.isFinite(ts) ? ts : Date.now()
}
```

## Tooltip Fix

Date tooltips in admin pages now show formatted German dates instead of raw epoch timestamps:

```tsx
// app/ui/admin-offerings-page.tsx — line 329
<td mix={tdStyle} title={formatDate(row.day)}>{formatDate(row.day)}</td>
```

This applies to the offerings table cells (`formatDate` for `day` column, `formatTimestamp` for `created_at`/`updated_at` columns).

## Working with Epoch Timestamps

All dates in this app are stored as epoch milliseconds (numbers or numeric strings). Always convert to `Date` before formatting:

```typescript
// From number
new Date(ts).toLocaleDateString('de-DE', ...)

// From string (nullable)
function formatTimestamp(ts: string | null): string {
  if (!ts) return '\u2014'
  return new Date(Number(ts)).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
```

## Known Limitations

| Limitation | Detail |
|------------|--------|
| `<input type="date">` locale | Display format depends on browser/OS language, not HTML. Chromium respects `lang="de"`; Firefox doesn't. |
| Comma in datetime | `toLocaleString('de-DE')` always produces `"25.05.2026, 22:13"` (with comma). Remove it by formatting date and time separately. |
| Single locale | All formatting is hardcoded to `'de-DE'`. Not suitable for multi-locale without refactoring to use `navigator.language` client-side. |

## Related

- `/development/remix3/locale/german-conventions.md` — HTML `lang`, browser inconsistencies, locale decisions
- `/development/remix3/data/guides/input-validation.md` — Form data validation patterns
- `/development/remix3/data/guides/form-data-handling.md` — FormData parsing
