# Example: CSS Prop

**Purpose**: Inline styling with the `css` mixin.

## Basic Button

```tsx
function Button() {
  return () => (
    <button
      mix={[
        css({
          color: 'white',
          backgroundColor: 'rgb(54, 113, 246)',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
        }),
      ]}
    >
      Click me
    </button>
  )
}
```

## Hover/Active States

```tsx
function Button() {
  return () => (
    <button
      mix={[
        css({
          '&:hover': { backgroundColor: 'rgb(37, 90, 210)' },
          '&:active': { transform: 'scale(0.98)' },
        }),
      ]}
    >
      Click
    </button>
  )
}
```

## Pseudo-elements

```tsx
function Button() {
  return () => (
    <button
      mix={[
        css({
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: '-2px',
            borderRadius: '8px',
            background: 'linear-gradient(45deg, blue, cyan)',
            zIndex: -1,
            opacity: 0,
          },
          '&:hover::before': { opacity: 1 },
        }),
      ]}
    >
      Click me
    </button>
  )
}
```

## Key Points

- Use `mix={[css({ ... })]}` - Not inline style attribute
- Nested rules: `&:hover`, `&::before`, `&::after`
- Pseudo-selectors work within component scope
- Vendor prefixes auto-handled
