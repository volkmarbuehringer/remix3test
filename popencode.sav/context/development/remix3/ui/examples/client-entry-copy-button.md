<!-- Context: development/remix3/examples/client-entry-copy-button | Priority: high | Version: 1.0 | Updated: 2026-05-05 -->

# Example: clientEntry Copy-to-Clipboard Button

**Core Idea**: Interactive component with `clientEntry(import.meta.url, ...)` — hydrates in-browser via `run()`, manages clipboard copy with visual feedback states and `signal.aborted` guards.

## Component

```typescript
import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

type CopyState = 'idle' | 'copied' | 'failed' | 'resetting'
interface Props extends SerializableProps { text: string }

export const PromptButton = clientEntry(import.meta.url,
  function PromptButton(handle: Handle<Props>) {
    let state: CopyState = 'idle'

    return () => (
      <button type="button" className={state}
        mix={[buttonStyle, on('click', async (_event, signal) => {
          try {
            await navigator.clipboard.writeText(handle.props.text)
            if (signal.aborted) return
          } catch {
            state = 'failed'; await handle.update(); await wait(1200)
            if (signal.aborted) return
            state = 'resetting'; await handle.update(); await wait(180)
            if (signal.aborted) return; state = 'idle'; handle.update(); return
          }
          state = 'copied'; await handle.update(); await wait(1200)
          if (signal.aborted) return
          state = 'resetting'; await handle.update(); await wait(180)
          if (signal.aborted) return; state = 'idle'; await handle.update()
        })]}
      >{/* label based on state */}</button>
    )
  },
)
```

## Key Patterns

| Pattern | Usage |
|---------|-------|
| `clientEntry(import.meta.url, ...)` | Hydration via source module URL |
| State machine | `idle → copied → resetting → idle` (or with `failed`) |
| `signal.aborted` check | Guards stale async after each `await` |
| `handle.update()` | Explicit re-render after state changes |
| `SerializableProps` | Ensures props serializable for client transfer |

## Reference
- Template: `~/remix/template/app/assets/prompt-button.tsx`
- Hydration: `concepts/hydration.md`
- Component model: `concepts/component-model.md`
