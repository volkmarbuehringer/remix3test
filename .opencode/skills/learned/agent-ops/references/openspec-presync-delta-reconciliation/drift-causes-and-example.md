# OpenSpec pre-sync: drift causes and worked example

Formerly part of `openspec-presync-delta-reconciliation` (now § OpenSpec Pre-Sync in `agent-ops`).

**Context:** Self-service appointments page where implementation diverged from specs (removed Endzeit field, removed ID column, removed text search). Delta specs must be updated before syncing.

## Problem

After implementing an OpenSpec change, the delta specs may no longer match the actual implementation. Syncing outdated delta specs to main specs creates inaccurate documentation that describes features, fields, or behaviors that don't exist. This leads to confusion in future sessions and erodes trust in the spec system.

Common causes of drift:

- Code review feedback removes/renames fields
- UX simplification removes UI elements (columns, filters, form fields)
- Technical constraints force a simpler approach than originally specified

## Example

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
