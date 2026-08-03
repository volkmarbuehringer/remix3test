## Context

The HTML bodies of all transactional emails are produced in `app/locale/de.ts` with a hand-rolled `esc()` helper and `.join('\n')` string arrays. Every other HTML site in the app uses the `remix/html-template` `html` tagged template, and the existing `transactional-email` spec already claims that mechanism. Motivation is in `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Move the four email HTML builders in `app/locale/de.ts` onto the `html` tagged template so escaping is automatic
- Coerce to a plain string at the locale boundary so `SendEmailOptions.html: string` and `app/utils/send-email.ts` stay untouched
- Align implementation with the existing `transactional-email` spec's "safe HTML generation" claim and close the `'`-escaping gap

**Non-Goals:**
- Not touching the 500/429/401 error responses or `createHtmlResponse` (separate concern; the 401 frame fragment must keep returning a bare fragment without a doctype)
- Not extracting HTML structure into a dedicated email-template module — the locale layer keeps owning copy + structure, as today
- Not changing the plain-text email variants — plain text must never be HTML-escaped

## Decisions

**D1: Coerce with `String(...)` at the locale boundary, not in `send-email.ts`.**
Each `html()` builder returns `String(html\`...\`)`. This keeps `SendEmailOptions.html: string` and `createSendEmail`/`sendVerificationEmail` untouched, and matches the app's existing `String(html\`...\`)` pattern in the error handlers. Alternatives considered: coercing inside `send-email.ts` (centralizes coercion but requires widening the `html` field type to accept `SafeHtml`, touching more code); moving the template into a new module (over-engineering for three emails). The locale boundary is a single, obvious coercion point.

**D2: Accept the dependency in `app/locale/de.ts`.**
The locale file currently imports nothing; adding `import { html } from 'remix/html-template'` is fine because `html-template` is a leaf, side-effect-free module (pure string functions, no I/O or env access) — no cascade-failure or testability risk. The "dependency-free locale layer" argument does not justify keeping a hand-rolled escaper.

**D3: Readable indentation in the template literals; output changes cosmetically only.**
The old `.join('\n')` arrays emitted compact lines with no leading whitespace; an indented `html` template literal emits leading whitespace on continuation lines. All existing assertions in `send-email.test.ts` use `.includes(...)`, and email clients ignore whitespace, so this is safe. Byte-stable output would require unindented templates (unreadable source) — not worth it.

**D4: Close the single-quote gap deliberately.**
The vendor escaper handles `'` → `&#39;` (`~/remix/packages/html-template/src/lib/safe-html.ts:25-36`); the manual `esc()` did not. Output is otherwise identical for `& < > "`. This is a strictly-safer behavior change, captured as a requirement in the delta spec and covered by a new test.

## Risks / Trade-offs

- [A future edit forgets `String(...)` and passes a `SafeHtml` object to nodemailer] → Mitigation: `SendEmailOptions.html` is typed `string`, so TypeScript rejects a `SafeHtml`; a new test asserts `typeof html === 'string'`.
- [Single-quote escaping changes output that some receiver renders literally] → Mitigation: `&#39;` is correct HTML for both text and attribute context; behavior is spec'd and tested.
- [de.ts gains an import] → Mitigation: leaf module, no I/O/env; mirrors imports already used across `server.ts` and the middleware.

## Migration Plan

Single-file change (`app/locale/de.ts`) plus test additions; deployable in one commit. Rollback is a revert of that file — no data or transport changes. Conventional commit: `refactor(email): use html template tag for email bodies` (or similar).
