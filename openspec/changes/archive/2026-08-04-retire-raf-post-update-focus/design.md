## Timing model

```
event handler
   │ state change
   ▼
handle.update()
   │ Frame flushes DOM (commit)
   ├─▶ ref callbacks run        (element mounted; self-focus here is fine)
   ├─▶ queueTask callbacks run  ◀── AFTER DOM changed; ABORTED on next render
   ▼
requestAnimationFrame (before paint)  ← weaker guarantee, NOT abortable
```

`queueTask` is the only one of these that (a) is documented for post-update DOM ops and (b) is
aborted when the component re-renders. That abortability is the actual bug fix: in `startDraft` →
`cancelDraft` the pending `rAF` would focus a removed input; a `queueTask` scheduled by `startDraft`
is cancelled by the `handle.update()` inside `cancelDraft`.

## Why the `renameInputs` lookup still works

`startEdit` stores the edit input in a `Map` (`renameInputs`) via a `ref` callback on the
conditionally-rendered `<input>`. Because `ref` callbacks run during commit (before `queueTask`),
the map is already populated when the `queueTask` callback runs:

```typescript
handle.queueTask(() => {
  let input = renameInputs.get(appt.id)
  if (input) {
    input.value = appt.title
    input.focus()
    input.select()
  }
})
```

No change to how the input is registered is required.

## Why this is NOT a blanket "convert all focus to queueTask"

Three distinct existing mechanisms coexist; only the `rAF` one is wrong:

| Mechanism | Example | Verdict |
|---|---|---|
| `rAF` after `update()` | `appointment-grid` (being fixed) | ❌ replace with `queueTask` |
| `ref` self-focus on mount | `appointtype-panel`, `lists-search` | ✅ keep |
| imperative `appendChild` + `focus()` | `client-grid-inline-edit`, `list-name-edit` | ✅ keep (no `update()` render) |

The learned delta encodes this boundary so the fix doesn't metastasize.
