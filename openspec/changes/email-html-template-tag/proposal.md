## Why

The HTML bodies of all transactional emails (verification, password reset, account deletion) are built in `app/locale/de.ts` with a hand-rolled `esc()` helper and `.join('\n')` string arrays — the only place in the app that does not use the `remix/html-template` `html` tagged template. The learned `remix-html-template` skill explicitly flags locale/i18n message functions as the most common place auto-escaping silently disappears. Escaping is currently only as reliable as every call site remembering to wrap values in `esc()`; the `html` tag makes it automatic. The existing `transactional-email` spec already claims these templates use `remix/html-template` — the implementation does not yet match that claim.

## What Changes

- Rewrite the four email HTML builders in `app/locale/de.ts` (`verification.html`, `passwordReset.html`, `accountDeletion.self.html`, `accountDeletion.admin.html`) to use the `html` tagged template from `remix/html-template`
- Coerce each result with `String(...)` so nodemailer receives a plain string (its `html` option is typed as `string | ...`, and `SafeHtml` is a `String` object, not a primitive)
- Remove the now-unused manual `esc()` helper
- Plain-text email variants are unchanged — they must NOT be HTML-escaped
- No new dependencies: `remix/html-template` is already in the package

## Capabilities

### New Capabilities

<!-- No new capabilities -->

### Modified Capabilities

- `transactional-email`: The existing requirement wording says HTML bodies are generated "using `remix/html-template` for safe HTML generation", but the implementation uses a manual escape helper. The requirement is tightened so that HTML email bodies are actually rendered through the `html` tagged template and coerced to a plain string for the transport, with automatic escaping of interpolated values — including single quotes, which the manual helper did not escape.

## Impact

- `app/locale/de.ts` — import `html` from `remix/html-template`, replace `esc()` + `.join('\n')` arrays with `html` tagged templates in the four HTML builders, delete the `esc` helper
- `app/utils/send-email.ts` — unchanged (`SendEmailOptions.html` stays `string`; coercion happens at the locale boundary)
- `app/utils/send-email.test.ts` — existing assertions stay green (escaping of `& < > "` is identical); optionally extend the escaping spec with a single-quote case
- No route or API changes; email wire format (`multipart/alternative` with `text` + `html`) is unchanged
