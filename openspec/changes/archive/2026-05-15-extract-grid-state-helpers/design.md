## Context

The client lab controller (`app/actions/client/controller.tsx`, 312 lines) manages a paginated, sortable, filterable grid of client records using Frame-based inline editing. State is propagated through URL query params (`offset`, `sort`, `order`, `filter`) and transferred into form submissions via hidden inputs (`_offset`, `_sort`, `_order`, `_filter`).

This state propagation logic is duplicated in 6 action handlers and 3 UI components. The existing `app/utils/pagination.ts` and `app/utils/sort-params.ts` already handle the low-level pagination query and sort parsing, but there's no abstraction for the state propagation pattern itself.

Existing utilities:
- `pagination.ts` — `paginate(db, table, options)` — offset-based pagination
- `sort-params.ts` — `parseSort(url, options)` — sort param parsing

## Goals / Non-Goals

**Goals:**
- Extract grid state data type and parsing functions into `app/utils/grid-state.ts`
- Extract shared hidden-inputs UI component into `app/ui/grid-state-hidden.tsx`
- Reduce each mutation handler in the controller from ~30 lines to ~10
- Remove all duplicated hidden-input blocks from edit-page, create-page, del-button

**Non-Goals:**
- No change to the pagination query logic (that's already clean in `pagination.ts`)
- No change to any route patterns, URL shapes, or form field names
- No change to the admin messages/chatlog controllers (they use simpler patterns)
- No generic "grid framework" — this is specific to the client lab's state shape

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Module location | `app/utils/grid-state.ts` | Co-located with other URL/data utilities. Not controller-specific since the pattern is shareable. |
| API style | Pure functions, not a class | Functional matches the existing `pagination.ts`/`sort-params.ts` style. No state to encapsulate. |
| GridState interface | `{ offset, sort, order, filter }` as strings | Matches the wire format. Keeps parsing (string→number) in the controller where the DB query lives. |
| Hidden inputs component | `app/ui/grid-state-hidden.tsx` | Shared UI component, mirrors the `input.ts`/`text.ts` mixin style. Named consistently with other UI files. |
| Redirect helper | `editingRedirect(base, editingId, state)` | Encapsulates the most common redirect pattern. Returns `Response` with 302. |
| Naming convention | `_offset`, `_sort`, etc. for form fields | Preserved exactly — these are already established across forms and tests. |

The key design choice was **string-based state vs. number-based state**. The wire format is strings (URL params and hidden inputs). The `index`/`grid` handlers convert `offset` to a number for pagination. Keeping state as strings in the utility means the utility stays purely about propagation, not about the specific DB query logic.

Alternatives considered and rejected:
- **Class-based GridState**: Would add ceremony without benefit for a stateless value object
- **Including the pagination query**: Mixing URL parsing with DB access would blur concerns
- **Generic form-state component**: Over-engineered for a single 4-field pattern

## Risks / Trade-offs

- **[Low] One more utility module to know about**: Mitigated by clear naming and existing precedent (`pagination.ts`, `sort-params.ts`)
- **[Low] Controller still has unique logic**: Each handler still has its own business logic (building changes, creating rows, etc.) — the extraction removes only the mechanical state plumbing, which is correct
- **[Low] Hidden-inputs component adds indirection**: But the alternative is repeating the same 4 `<input>` elements three times, which is worse
