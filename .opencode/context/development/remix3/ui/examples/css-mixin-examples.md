# Example: CSS Mixins

**Core Idea**: Style via `css(...)` mixin, CSS-in-JS with pseudo-classes/nested.

**Key Points**:
- `css({ ... })` returns mixin object
- Supports pseudo-classes: `'&:hover'`, `'&:active'`
- Supports pseudo-elements: `'&::before'`, `'&::after'`
- Nested selectors: `'.child': { ... }`
- All values must be serializable (no functions)

**Quick Example**:
```tsx
function Button() {
  return () => (
    <button
      mix={[
        css({
          color: 'white',
          backgroundColor: 'rgb(54, 113, 246)',
          padding: '8px 16px',
          borderRadius: '4px',
          '&:hover': {
            backgroundColor: 'rgb(37, 90, 210)',
          },
        }),
      ]}
    >
      Click me
    </button>
  )
}
```

**Advanced (Nested + Pseudo-elements)**:
```tsx
function GlowButton() {
  return () => (
    <button
      mix={[
        css({
          position: 'relative',
          '&:hover::before': {
            opacity: 1,
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: '-2px',
            zIndex: -1,
            opacity: 0,
            transition: 'opacity 0.2s',
          },
        }),
      ]}
    >
      Click me
    </button>
  )
}
```

**Reference**: [remix-run/component docs](https://github.com/remix-run/remix/tree/main/packages/component/docs)