---
name: repeated-block-collapse-refactor
description: "Use when the same multi-line object-literal block is copy-pasted across many call sites (loader overrides, option objects, fixtures) and you want one composite helper — inventory the blocks by shape, collapse them with a script, prune imports, and diff the variant shapes."
metadata:
  origin: auto-extracted
---

# Collapsing Repeated Multi-Line Blocks into One Composite Helper

**Extracted:** 2026-09-12
**Context:** 43 copies of a six-line loader-override block (`offset: gridStateOffset(gridValues), sortColumn: …`) were spread across five Remix 3 route controllers. Replacing them with `...gridStateOverrides(gridValues)` removed 184 net lines.

## Problem

The duplicated unit is a *fragment of an object literal*, not a function call, so the usual tools mislead:

- `replace_all` only works where the text is byte-identical — variants (fewer keys, deeper indent, extra keys interleaved) silently survive it;
- hand-editing dozens of sites is error-prone, and a discovery grep truncated with `| head -20` undercounts (it hid 4 of 9 sites in a sibling refactor in the same session);
- the "mechanical" label is wrong wherever a variant *omitted* a key, because the composite helper supplies every key.

## Solution

1. **Inventory by shape, not by eye.** Walk each file and group consecutive matching lines by `(indent, key list)`:

   ```js
   const getterLine =
     /^(\s*)(offset|sortColumn|sortDirection|filter|period|status): gridState\w+\(gridValues\),$/
   // for each maximal run: key = [indent, keys.join(',')] → count
   ```

   43 sites turned out to be 9 shapes (2–3 per file). That decides the tool: a handful of `replace_all` edits per file, no script needed — and it surfaces which sites are *not* uniform.

2. **Collapse runs with a script once there are ~15+ sites.** Replace any maximal run of matching lines with one spread line at the run's indentation; never re-type the fragments by hand.

3. **Prune named imports from the rewritten text,** not from memory: keep an import only if `new RegExp('\\b' + name + '\\(').test(rewritten)` still matches. Keep the trailing `\(` so `gridStateFromForm` does not shadow `gridStateFromFormData`.

4. **Diff every variant shape before calling it mechanical.** A variant that omitted keys changes behavior once the composite supplies them:
   - 2 of 10 offerings branches omitted `status`, so they dropped an active status filter on re-render; the composite restores it — disclose that as a normalization, matching the other 8 branches.
   - For the reverse case, prove the extras are inert: `grep 'overrides?\?\.period\|overrides?\?\.status'` on the loaders that do not declare them. If they never read the key, passing it is harmless.

5. **Type the composite `| undefined`-friendly** (`offset: number | undefined`, …) so `exactOptionalPropertyTypes` accepts `{ ...composite() }` spread into narrower loader-override types. Properties arriving via a spread are not excess-property-checked — verify with `tsc`, don't assume.

6. **Verify in stages:** `tsc --noEmit` + lint + the affected controller tests + a new unit test for the composite, then the full suite before pushing.

## When to Use

- The same multi-line object-literal fragment appears at many call sites and one composite helper + spread would replace it.
- Choosing between `replace_all`, a scripted rewrite, and hand edits for a repetitive refactor.
- A supposedly mechanical bulk refactor has variant shapes that need a per-shape semantic diff.
- Pruning named imports after deleting their call sites.
