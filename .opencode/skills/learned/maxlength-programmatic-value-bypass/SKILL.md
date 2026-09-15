---
name: maxlength-programmatic-value-bypass
description: "Use when setting an input/textarea value programmatically (chip click, autofill, URL prefill) and the maxLength cap silently stops applying — clamp with slice(), the attribute only guards typed input."
metadata:
  origin: auto-extracted
---

# Programmatic value assignment bypasses the maxLength attribute

**Extracted:** 2026-09-15
**Context:** Prefilling a composer textarea from a clickable example chip in a Remix 3 admin page.

## Problem
The HTML `maxLength` attribute only guards user typing/pasting. Assigning `element.value = x` in JS bypasses the cap, so a programmatic value can exceed the limit and be rejected server-side (400) with a confusing error — the counter shows "6000 / 5000" with no way to shorten it.

## Solution
Clamp on assignment, sourcing the limit from the same constant the server validates against:

```ts
textarea.value = command.slice(0, MAX_MESSAGE_LENGTH)
```

- Keep one shared `MAX_MESSAGE_LENGTH` in an allowlisted util read by both the server validator and every composer, so the client cap can never drift from what the server accepts.
- After clamping, re-run any char-counter update and set the caret to the clamped length (`setSelectionRange(value.length, value.length)`).

## When to Use
- Prefilling a field from a clickable example/chip/suggestion
- Autofill, URL-param prefill, or restoring a draft into a `maxLength`-bounded field
- A character counter shows a value above the max the user never typed