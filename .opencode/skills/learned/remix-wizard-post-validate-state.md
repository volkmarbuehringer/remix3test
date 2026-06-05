---
name: remix-wizard-post-validate-state
description: "Preserve multi-step wizard state on POST validation error re-renders in Remix"
user-invocable: false
origin: auto-extracted
---

# Remix Wizard State on POST Validation Error

**Extracted:** 2026-06-05
**Context:** Multi-step wizard forms in Remix where step context is needed to re-render on validation errors

## Problem
In a Remix multi-step wizard, form submissions are POST requests. When validation fails and the action re-renders the page, `context.url.searchParams` is empty (POST has no query params). Wizard context values like `resource_id`, `day`, and `step` are only in `formData`, not the URL. If the shared data loader uses URL params to derive wizard data (offerings, time slots), the re-rendered page will have broken UI — empty dropdowns, missing computed data.

## Solution
Extract wizard context from `formData` at the top of the action handler, and pass them explicitly as overrides to the data loading function on every error re-render path.

```typescript
// In the action handler:
let formData = context.formData

// Extract wizard context from hidden form fields
let wizardResourceId = (formData.get('resource_id') as string) || undefined
let dateRaw = (formData.get('date') as string) || undefined
let wizardDay = dateRaw ? new Date(dateRaw + 'T00:00:00Z').getTime() : undefined

// Pass to every error re-render:
let data = await loadPageData(context, userId, {
  step: 3,
  wizardResourceId,
  wizardDay,
  formValues,
  fieldErrors,
  formError: 'Validation failed.',
})
return renderPage(context, data, { status: 400 })
```

The data loader then uses `overrides.wizardResourceId` and `overrides.wizardDay` (falling back to URL params for GET requests):

```typescript
let wizardResourceId = overrides?.wizardResourceId
  ?? context.url.searchParams.get('resource_id')
  ?? undefined

let wizardDayStr = overrides?.wizardDay !== undefined
  ? String(overrides.wizardDay)
  : (context.url.searchParams.get('day') || undefined)
```

## When to Use
- Multi-step wizard in Remix where the form POST action re-renders the full page on validation errors
- Data loading function derives time slots, offerings, or other data from wizard step context
- Hidden inputs carry wizard state (resource_id, date, step) through the form submission
