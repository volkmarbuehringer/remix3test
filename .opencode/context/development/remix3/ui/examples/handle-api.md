# Example: Handle API

**Purpose**: handle methods for state, tasks, and lifecycle.

## handle.update()

Trigger re-render after state change:

```tsx
function Counter(handle: Handle) {
  let count = 0

  return () => (
    <button
      mix={[
        on('click', () => {
          count++
          handle.update() // Trigger re-render
        }),
      ]}
    >
      {count}
    </button>
  )
}
```

## handle.queueTask()

Deferred operations after render (focus, scroll):

```tsx
function FormWithScroll(handle: Handle) {
  let showDetails = false
  let sectionRef: HTMLElement

  return () => (
    <div>
      <label>
        <input
          type="checkbox"
          checked={showDetails}
          mix={[on('change', (event) => {
            showDetails = event.currentTarget.checked
            handle.update()
            if (showDetails) {
              handle.queueTask(() => {
                sectionRef.scrollIntoView({ behavior: 'smooth' })
              })
            }
          })]}
        />
        Show
      </label>
      {showDetails && (
        <section ref={(node) => (sectionRef = node)}>Details</section>
      )}
    </div>
  )
}
```

## handle.signal

AbortSignal for cleanup:

```tsx
function Clock(handle: Handle) {
  let interval = setInterval(() => {
    if (handle.signal.aborted) {
      clearInterval(interval)
      return
    }
    handle.update()
  }, 1000)

  return () => <span>{new Date().toLocaleTimeString()}</span>
}
```

