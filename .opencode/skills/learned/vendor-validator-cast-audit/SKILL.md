---
name: vendor-validator-cast-audit
description: "Use when replacing a hand-rolled coercion (`x === 'a' ? A : B`) with a vendor helper that validates or throws, or when a dependency update adds runtime validation — audit `as`-cast boundary adapters first, or a silent default becomes a 500."
metadata:
  origin: auto-extracted
---

# Adopting a Validating Vendor Helper: Audit Cast Boundaries First

**Extracted:** 2026-09-12
**Context:** Replaced a hand-rolled `direction === 'desc' ? 'DESC' : 'ASC'` with the vendor `compileOrderByDirection()` (`remix/data-table/sql-helpers`), which throws on anything that is not `asc`/`desc`. One app-level boundary adapter asserted the type instead of validating it, so four admin controllers could turn a tampered hidden form field into a 500.

## Problem

A local coercion and a vendor validator are not equivalent for invalid input:

- hand-rolled: `x === 'desc' ? 'DESC' : 'ASC'` → invalid input silently becomes a default
- vendor: `compileOrderByDirection(x)` → `TypeError: Invalid order by direction: expected "asc" or "desc"`

When a caller's argument type comes from an unchecked cast (`as 'asc' | 'desc'`) rather than a runtime parse, the swap converts graceful degradation into an uncaught throw. In the source case a hidden, client-supplied grid-state field (`_order`) reached the appointment/offering list queries on four controllers' re-render paths, so `POST` with `_order=bogus` plus any re-render trigger (field error, rate limit, constraint collision) returned a 500 where the action used to re-render its validation errors.

## Solution

1. **Read the vendor helper before swapping.** Does it validate, throw, normalize case, or accept `unknown`? `compileOrderByDirection(direction: unknown)` is case-insensitive and throws on anything else — that is a behavior change, not a rename.
2. **Enumerate call sites by count, not by eye.** Run `grep -rn "<oldPattern>" app | wc -l` first, then work the list; a discovery grep truncated with `| head -20` hid 4 of 9 sites in the source case. Re-grep after editing and require zero matches.
3. **Classify each argument's provenance:**
   - parsed/whitelisted — `parseSort(url, { allowedColumns })`, `raw._order === 'asc' ? 'asc' : 'desc'` → safe; the throwing branch is unreachable
   - `as`-cast boundary — `return (state.order as 'asc' | 'desc') || undefined` → **patch the boundary before swapping**
4. **Fix the boundary once, not every call site.** A whitelist at the adapter keeps the previous runtime behavior for invalid input and makes the type honest:

   ```ts
   export function gridStateDirection(state: GridState): 'asc' | 'desc' | undefined {
     return state.order === 'asc' || state.order === 'desc' ? state.order : undefined
   }
   ```

5. **Add a regression test that fails without the fix**, driven through the real entry point (a tampered hidden field on a POST that re-renders), and prove it by stashing the fix:
   - without: `Invalid order by direction … at compileOrderByDirection → listAppointments → loadAppointmentPageData`
   - with: 200 re-render of the validation panel

## When to Use

- Swapping a hand-rolled coercion for a vendor helper that throws on invalid input.
- A dependency update introduces runtime validation where the old code coerced silently.
- Reviewing a diff that replaces `x === 'a' ? A : B` with a vendor `compile*` / `parse*` / `assert*` call.
- Auditing which callers feed a newly-validating function from an `as` cast rather than a parse.
