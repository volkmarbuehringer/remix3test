# Question Options as Action Buttons

**Source:** `agent-ask-user-action-buttons`

## Problem

When an agent asks a question with a small set of single-select options (e.g., "Lock user 5?" with options `["Confirm"]` or `["Lock user 5", "Cancel"]`), rendering them as radio buttons + a separate "Confirm" button requires two clicks and extra visual noise. The "Confirm" button itself is superfluous — each option is already meaningful. If the user just wants to proceed without selecting an action, the text input is always available.

## Solution

When the question uses single-select mode and has 6 or fewer options, render each option as a direct inline action button. Clicking a button immediately submits that option's value without requiring a separate confirmation click.

```typescript
let useButtons = !isMulti && optionList.length <= 6

if (useButtons) {
  let btnGroup = document.createElement('div')
  btnGroup.style.display = 'flex'
  btnGroup.style.flexWrap = 'wrap'
  btnGroup.style.gap = '6px'

  for (let opt of optionList) {
    let optBtn = document.createElement('button')
    optBtn.textContent = opt.label
    optBtn.onclick = () => {
      btnGroup.querySelectorAll('button').forEach((b) => (b.disabled = true))
      handleAnswer(opt.label)
    }
    if (opt.description) {
      optBtn.title = opt.description
    }
    btnGroup.appendChild(optBtn)
  }
  el.appendChild(btnGroup)
} else {
  // Fall back to radio/checkboxes + Confirm button
  // for multi-select or large option sets (>6)
}
```

**Result:**

```
Before:                         After (≤6 single-select options):
┌──────────────────┐           ┌──────────────────────────┐
│ Lock user 5?     │           │ Lock user 5?             │
│ ◉ Lock user 5    │           │ [Lock user 5] [Cancel]   │
│ ◉ Cancel         │           └──────────────────────────┘
│ [Confirm]        │
└──────────────────┘
```

## Key details

- **Threshold**: ≤6 options, single-select only. Beyond that or multi-select, keep the checkbox + confirm pattern since selecting multiple inline buttons is awkward.
- **Double-submit guard**: Disable all buttons in the group on first click rather than clearing the bubble (which creates a jarring visual gap).
- **Descriptions**: Preserve option descriptions via `title` attribute on buttons.
- **Text input always remains**: The user can type a new message instead of clicking any button — the text input below the chat is never removed.
