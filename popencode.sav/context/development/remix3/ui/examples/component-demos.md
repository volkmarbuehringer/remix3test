# Example: Component Basics

**Purpose**: Minimal working examples of core component patterns.

## Basic Counter

```tsx
function Counter(handle: Handle) {
  let count = 0 // Component phase: runs once

  return () => ( // Render phase: runs on updates
    <button
      mix={[
        on('click', () => {
          count++
          handle.update()
        }),
      ]}
    >
      Count: {count}
    </button>
  )
}
```

## Component with Props

```tsx
function Greeting(handle: Handle<{ name: string }>) {
  return () => <h1>Hello, {handle.props.name}!</h1>
}
// Usage: <Greeting name="World" />
```

## Controlled Input

```tsx
function SlugForm(handle: Handle) {
  let slug = ''
  let generatedSlug = ''

  return () => (
    <form>
      <label>
        <input
          type="checkbox"
          mix={[on('change', (event) => {
            generatedSlug = event.currentTarget.checked
              ? crypto.randomUUID().slice(0, 8)
              : ''
            handle.update()
          })]}
        />
        Auto-generate
      </label>
      <input
        value={generatedSlug || slug}
        disabled={!!generatedSlug}
        mix={[on('input', (event) => {
          slug = event.currentTarget.value
          handle.update()
        })]}
      />
    </form>
  )
}
```

## Fragments

```tsx
function List() {
  return () => (
    <ul>
      <><li>Item 1</li><li>Item 2</li></>
    </ul>
  )
}
```

