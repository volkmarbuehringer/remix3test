---
name: openspec-presync-delta-reconciliation
description: 'Reconcile delta specs with actual implementation before syncing to main specs to prevent stale documentation'
user-invocable: false
origin: auto-extracted
---

# OpenSpec: Reconcile Delta Specs with Implementation Before Syncing

**Extracted:** 2026-06-05
**Context:** Self-service appointments page where implementation diverged from specs (removed Endzeit field, removed ID column, removed text search). Delta specs must be updated before syncing.

## Problem

After implementing an OpenSpec change, the delta specs may no longer match the actual implementation. Syncing outdated delta specs to main specs creates inaccurate documentation that describes features, fields, or behaviors that don't exist. This leads to confusion in future sessions and erodes trust in the spec system.

Common causes of drift:

- Code review feedback removes/renames fields
- UX simplification removes UI elements (columns, filters, form fields)
- Technical constraints force a simpler approach than originally specified

## Solution

Before syncing delta specs to main specs, reconcile them against the actual implementation:

1. **Read the delta spec** to understand what was originally planned
2. **Compare with the actual implementation** — check controllers, schemas, UI components
3. **Update the delta spec** to match reality:
   - Remove or rename requirements/scenarios that changed
   - Add any new scenarios or constraints discovered during implementation
   - Correct field names, column names, and UI labels
4. **Sync the reconciled delta spec** to main specs

### Example

**Before (outdated delta):**

```
#### Scenario: Create form has no user field
- **WHEN** user clicks "Neu"
- **THEN** the form panel shows fields: Ressource, Titel, Datum, Startzeit, Endzeit
```

**After (reconciled — Endzeit was removed, always 1 hour):**

```
- **THEN** the form panel shows fields: Ressource, Titel, Datum, Startzeit
- **THEN** the end time is always 1 hour after the start time (no end time selection)
```

## When to Use

- Before running `openspec-sync-specs` for any completed change
- When code review feedback modified the original design
- When implementation discovered constraints not in the original spec
- When the UI or API surface differs from what was initially spec'd
