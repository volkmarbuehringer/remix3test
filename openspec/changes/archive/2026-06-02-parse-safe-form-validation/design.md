## Context

Three form controllers in the codebase currently use hand-written validation functions wrapped around `s.parse()` try/catch blocks:

```
admin-offerings-controller:   s.parse() + validateOfferingForm() + try/catch
admin-appointments-controller: s.parse() + validateAppointmentForm() + try/catch
client/controller:             s.parseSafe() + inline validation + issuesToFieldErrors
```

The `/client` route already uses `parseSafe` (Remix 3's no-throw parser) and re-render-from-POST, but some validation logic (registered year check) remains inline rather than in schema `.refine()` chains. The admin routes use `s.parse()` (throws) with custom validation functions — the try/catch around parse loses grid state because parsed form values are inaccessible on failure.

Remix 3's `timeboxer` demo pattern: `s.parseSafe(schema, formData)` → check `result.success` → `issuesToErrors(result.issues)` → re-render. Validation lives entirely in the schema via `.refine()`. Cross-field/business rules are manual post-parse checks.

**Architectural constraint**: Admin routes use `createSidebarLayout` with `ShellOrFragment`, which renders `<Layout><Frame src=.../></Layout>` for non-frame requests, discarding children. Form POSTs arrive without `X-Remix-Target` header, so `context.render()` content is lost. Admin form validation MUST use redirect (302) + URL-encoded state (`fv_*`/`fe_*` params), not re-render-from-POST.

## Goals / Non-Goals

**Goals:**

- Extract shared `issuesToFieldErrors()` and `readFormFieldValues()` utilities in `app/utils/schema-utils.ts`
- Define declarative `offeringSaveSchema` in `app/utils/offering-schema.ts` using `coerce.number()` + `.refine()` — replaces `validateOfferingForm()` entirely
- Define declarative `appointmentSaveSchema` in `app/utils/appointment-schema.ts` — replaces `validateAppointmentForm()` entirely
- Replace `s.parse()` try/catch in admin controllers with `s.parseSafe()` — no more lost grid state on parse errors
- Refine `/client` controller schema to move remaining inline validation into `.refine()` chains
- Cross-field checks (`endMin > startMin`) remain manual post-parse — matches timeboxer demo pattern
- Business rule errors (holiday, past-date, exclusion, slot bookability) remain manual controller checks with redirects

**Non-Goals:**

- No changes to `destroy`, `configSave`, or `weekGenerate` actions in offerings controller
- No changes to the Frame-based admin layout architecture (`ShellOrFragment`, `createSidebarLayout`)
- No changes to the redirect + URL-param pattern for admin routes — this is the working strategy
- No client-side validation
- No changes to other admin controllers (`admin-users`, `admin-resources`, `admin-offering-configs`)
- No changes to `app/utils/form-params.ts` (fv_/fe_ encoding/decoding)

## Decisions

### 1. Schema per domain entity, not per controller

Offerings and appointments get separate schema files at `app/utils/offering-schema.ts` and `app/utils/appointment-schema.ts`. This keeps schemas close to their domain data but pure (no controller/UI imports). Each exports the `f.object` schema, field name constants for URL encoding, and any helper types.

**Alternative considered**: One schema in each controller file. Rejected because schemas are pure logic that should be testable without a router or Response.

### 2. coerce.number() for all numeric fields

All numeric form fields (`resource_id`, `start_min`, `end_min`, `user_id`) use `coerce.number()` + `.refine()`. This eliminates manual `parseInt(parsed.x, 10)` calls in controllers. Empty strings fail `coerce.number()` (not returning 0), which is correct behavior for required fields.

**Alternative considered**: `s.string().pipe(coerce.number())` to handle absent/missing fields. Unnecessary — all required fields are present in form submissions from `GridStateHiddenInputs`. Empty selects produce `""` which `coerce.number()` correctly rejects.

### 3. .refine() on individual f.field() schemas, not f.object()

Per-field `.refine()` chains (e.g., `f.field(coerce.number().refine(n => n > 0, '...'))`) produce issues with correct `path[0]` field names matching `f.object()` key. `.refine()` on the outer `f.object()` produces root-level `[]` paths even with explicit `{ path: ['end_min'] }`.

**Alternative considered**: `.refine()` on `f.object()` with explicit path option. While the data-schema implementation does respect explicit `path` in `.refine()` options, the path would be `['end_min']` but the issue would not carry the full context chain. Individual field `.refine()` is the documented, well-tested pattern used in timeboxer.

### 4. Cross-field validation stays manual post-parse

`endMin > startMin` is a cross-field concern. Timeboxer's auth controller demonstrates this pattern: `parseSafe` handles per-field rules, then manual `if (existingUser)` checks handle cross-field/business concerns. We follow the same separation: schema for per-field rules, controller for cross-field and business rules.

**Alternative considered**: `.refine()` on outer `f.object()` with `{ path: ['end_min'] }`. While technically possible, it mixes schema concerns (type/shape) with business concerns (domain invariants). The timeboxer demo intentionally keeps them separate.

### 5. Admin controllers keep redirect pattern, client keeps re-render

The architectural split is permanent:

```
Client route (/client):         Admin routes (/admin/*):
Layout (no Frame)                ShellOrFragment (Frame-based)
    ↓                                ↓
re-render-from-POST ✓           redirect + URL params ✓
context.render(<Page .../>)     buildErrorRedirect(...)
```

ParseSafe improves both paths by eliminating the try/catch and custom validation functions. The render strategy is untouched.

### 6. Read raw FormData values before parseSafe

Schema coercion transforms `"5"` → `5`, `"480"` → `480`. To preserve submitted values for form re-rendering, raw string values are read from `FormData` before `parseSafe` runs (via `readFormFieldValues`). This ensures the form shows exactly what the user typed, not the coerced type.

**Alternative considered**: Reading from `result.value` after successful parse. Rejected because `result.value` has coerced types (numbers, not strings) and parseSafe's `.value` is undefined on failure.

## Risks / Trade-offs

- **[Risk] `.refine()` message format changes in Remix updates**: The `.refine()` API is part of Standard Schema v1 and Remix's own schema library. If the message format or path structure changes, tests will catch it. Mitigation: unit tests for schema validation output.

- **[Risk] Schema file proliferation**: Each domain entity gets its own schema file. Mitigation: schemas are small (~30 lines each), pure, and colocated with their domain in `app/utils/`.

- **[Risk] Select comparison still needs `String()` coercion**: PostgreSQL sends `number` type for `resource_id`, URL params are `string`. The form's select `selected` check still needs `String(a) === String(b)`. Mitigation: proven pattern already used in `admin-appointments-form.tsx`.

- **[Trade-off] parseSafe issues are English by default**: `coerce.number()` produces "Expected number" in English. `.refine()` messages are German. Mixed-language issues are acceptable because `.refine()` catches coerce failures with domain messages, and `issuesToFieldErrors` deduplicates (first message wins).

## Open Questions

- None. All Phase 2 open questions from `offerings-in-memory-token/phase-2-parseSafe.md` were resolved by source-code analysis of `node_modules/@remix-run/data-schema/src/lib/`.
