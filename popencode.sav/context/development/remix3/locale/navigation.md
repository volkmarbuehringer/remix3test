<!-- Context: development/remix3/locale | Priority: medium | Version: 1.0 | Updated: 2026-05-26 -->

# German Locale & Date Conventions

**Core Idea**: Single-locale German app conventions — HTML `lang="de"`, `Intl` API with hardcoded `'de-DE'` locale, `<input type="date">` browser behavior.

## Quick Routes

| Task | File |
|------|------|
| Locale decisions, HTML lang, browser differences | `german-conventions.md` |
| Date formatting patterns & updated files | `/development/remix3/data/guides/date-handling.md` |

## Key Decisions

- **Single locale**: Hardcoded `'de-DE'` everywhere — no runtime locale detection
- **No manual formatting**: `Intl` API only — no `getDate()`, `padStart()`, etc.
- **`lang="de"`**: Set on `<html>` element; helps Chromium date inputs but incomplete solution
- **Epoch timestamps**: All dates stored as epoch ms, converted via `new Date(Number(ts))`
