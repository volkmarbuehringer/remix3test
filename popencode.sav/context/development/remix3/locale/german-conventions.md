<!-- Context: development/remix3/locale/german-conventions | Priority: high | Version: 1.0 | Updated: 2026-05-26 -->

# German Locale Conventions

**Purpose**: Document the locale decisions made for this single-locale German appointment scheduling app — HTML `lang` attribute, `<input type="date">` behavior, and server-side formatting locale choice.

## HTML `lang="de"` Setting

The root `<html>` element was changed from `lang="en"` to `lang="de"`:

```tsx
// app/ui/document.tsx — line 40
<html lang="de" data-theme={isDark ? 'dark' : undefined} style="overflow-y:scroll">
```

**Impact**: Affects `<input type="date">` display format in Chromium-based browsers (Chrome, Edge, Opera). Firefox does **not** respect the HTML `lang` attribute for date input formatting.

## OS Locale Limitation

The display format of `<input type="date">` is ultimately controlled by the browser/OS language setting, not by HTML attributes alone:

| Browser | Behavior |
|---------|----------|
| Chrome / Chromium | Respects HTML `lang` attribute. `lang="de"` → `TT.MM.JJJJ` |
| Firefox | Ignores `lang`, uses browser UI language setting |
| Brave (anti-fingerprinting) | May override with a neutral format regardless of `lang` |

No pure HTML solution guarantees consistent German date display across all browsers.

## Hardcoded `'de-DE'` Locale

Since this is a single-locale German app, all server-side `Intl` formatting uses hardcoded `'de-DE'`:

| Pattern | Code | Output |
|---------|------|--------|
| Date-only | `.toLocaleDateString('de-DE', options)` | `25.05.2026` |
| Datetime | `.toLocaleString('de-DE', options)` | `25.05.2026, 22:13` |
| Time-only | `.toLocaleTimeString('de-DE', options)` | `22:13` |

One outlier exists in `app/ui/admin-lists-page.tsx` (line 27) which uses `'de'` (without region) — this works but is inconsistent with the rest of the codebase. Prefer `'de-DE'` everywhere for uniformity.

> **Multi-locale in the future**: Switch to client-side formatting using `navigator.language` instead of hardcoded `'de-DE'`. The `Intl` API is available in all modern browsers.

## Source Files

| File | Change |
|------|--------|
| `app/ui/document.tsx` | `lang="en"` → `lang="de"` |

## Related

- `/development/remix3/data/guides/date-handling.md` — Date formatting patterns and files updated
