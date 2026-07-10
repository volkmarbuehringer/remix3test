## Context

newapp's login and register pages currently use a generic panel layout (`<div mix={panelCss}>`) inside a page stack. The timeboxer-demo (`~/remix/demos/timeboxer`) has a cleaner centered-card design with an eyebrow/title/body typography pattern, proper card shadow, and dedicated `AuthShell`/`AuthForm` components. This change ports that visual design to newapp while keeping all existing auth behavior intact.

### Timeboxer Design Pattern

```
  centered grid (min-height: 100vh - 80px)
  ┌────────────────────────────────────────┐
  │         ┌──────────────────┐           │
  │         │  EYEBROW (12px,  │           │  card: max 420px
  │         │   uppercase)     │           │  bg: surface.lvl1
  │         │                  │           │  border: subtle
  │         │  Title (28px)    │           │  radius: xl (16px)
  │         │                  │           │  shadow: lg
  │         │  Description     │           │  padding: xl (24px)
  │         │                  │           │
  │         │  [ERROR BANNER]  │           │  red bg, red border
  │         │                  │           │
  │         │  Field Label     │           │
  │         │  [==========]    │           │
  │         │  [field error]   │           │  red text
  │         │                  │           │
  │         │  [==== BTN ====] │           │  primary, full width
  │         │                  │           │
  │         │  Footer text     │           │  link to other page
  │         └──────────────────┘           │
  └────────────────────────────────────────┘
```

### Current newapp Pattern

```
  <Layout>
    <div mix={pageStack + maxWidth}>
      <div mix={panel}>
        <brand mark />
        <h1>Login</h1>
        [error banner — left border style]
        <form>
          <CsrfTokenInput />
          [fields]
          [Button]
        </form>
        <p>link</p>
        <demo hints box>
      </div>
    </div>
  </Layout>
```

Both already use `Layout` wrappers and render within the main app shell — no frame layout issues.

## Goals / Non-Goals

**Goals:**

- Create a shared `AuthShell` component providing the centered-card layout with eyebrow/title/description
- Create a shared `AuthForm` component providing form boilerplate (error banner, CSRF, submit button, footer)
- Restyle login page to use the new components with timeboxer-inspired visual design
- Restyle register page similarly
- Adapt the design for dark theme using newapp's existing theme tokens
- Reuse newapp's `CsrfTokenInput`, `Button`, and `input` mixins

**Non-Goals:**

- Does NOT add field-level validation errors (newapp controllers use single `error` string; AuthForm can accept `errors` prop for future use but it won't be wired yet)
- Does NOT change any auth middleware, session handling, or route definitions
- Does NOT change rate limiting behavior
- Does NOT change the auth method (stays email-based)
- Does NOT remove the brand mark from the login page (newapp-specific branding)
- Does NOT remove demo account hints from the login page

## Decisions

### Shared component location: `app/ui/auth-card.tsx`

Extract `AuthShell` and `AuthForm` into a new shared UI file. This follows newapp's convention of `app/ui/` for shared components (e.g., `app/ui/page-primitives.tsx`).

**Alternative considered**: Inline both components in each controller. Rejected — the timeboxer pattern extracts them; we should too for consistency and DRY.

### AuthShell: card wrapper only

`AuthShell` provides only the visual card container — centered grid, bordered card with shadow, eyebrow/title/description typography. It does NOT include the form tag, fields, or error handling. This separation allows each page to compose its own form content.

```tsx
type AuthShellProps = {
  children?: RemixNode
  description: string
  eyebrow: string
  title: string
}
```

### AuthForm: form boilerplate

`AuthForm` handles the `<form>` tag, CSRF token input, conditional error banner, and submit button. Fields go in as children. An optional `footer` prop handles the "Don't have an account?" / demo hints area.

```tsx
type AuthFormErrors = {
  form?: string
  [field: string]: string | undefined
}

type AuthFormProps = {
  action: string
  children: RemixNode
  error?: string
  errors?: AuthFormErrors // future: field-level errors
  footer?: RemixNode
  submitLabel: string
}
```

The `errors` prop is included for forward compatibility (timeboxer supports it) but won't be wired by the controllers yet since they produce a single `error` string.

### Theme token mapping

Timeboxer uses `RMX_01` tokens. newapp has a custom `Theme` in `app/theme.tsx` with equivalent tokens. The card design maps to:

| Visual element      | Timeboxer token                         | newapp equivalent                       |
| ------------------- | --------------------------------------- | --------------------------------------- |
| Card background     | `theme.surface.lvl1` (#f8f8f8)          | `theme.surface.lvl1`                    |
| Card border         | `theme.colors.border.subtle`            | `theme.colors.border.subtle`            |
| Card shadow         | `theme.shadow.lg`                       | `theme.shadow.lg`                       |
| Card radius         | `theme.radius.xl` (16px)                | `theme.radius.xl`                       |
| Eyebrow color       | `theme.colors.text.muted`               | `theme.colors.text.muted`               |
| Title color         | `theme.colors.text.primary`             | `theme.colors.text.primary`             |
| Body color          | `theme.colors.text.secondary`           | `theme.colors.text.secondary`           |
| Input border        | `theme.colors.border.default`           | `theme.colors.border.default`           |
| Focus ring          | `theme.colors.focus.ring`               | `theme.colors.focus.ring`               |
| Error banner bg     | `theme.colors.action.danger.background` | `theme.colors.action.danger.background` |
| Error banner border | `theme.colors.action.danger.border`     | `theme.colors.action.danger.border`     |
| Error banner text   | `theme.colors.action.danger.foreground` | `theme.colors.action.danger.foreground` |

All token paths match 1:1 between RMX_01 and newapp's theme. No translation needed.

### AuthForm renders CsrfTokenInput, not manual hidden input

Timeboxer renders `<input type="hidden" name="_csrf" value={csrfToken} />` manually. newapp has a `CsrfTokenInput` component that reads from `context.csrfToken`. Keep newapp's pattern.

### LoginPage brand mark preserved

The login page currently has a brand mark (colored dot + "newapp" label) before the heading. This is newapp-specific branding and should be kept inside the card, above the title. Timeboxer doesn't have this — but it's a newapp identity element, not auth UI.

### Demo hints move inside card footer

Currently demo hints render in a separate `<div>` below the form panel. They'll move into the `AuthForm`'s `footer` prop, inside the card. This keeps them visually grouped with the login form.

### Input styling: reuse newapp's `input` mixins

newapp has `input.base` and `input.focus` in `app/ui/mixins/input.ts`. These provide consistent input styling across the app. Timeboxer inlines its own input styles. We'll use newapp's mixins for consistency with the rest of the app, adding any missing styles (like `aria-invalid` state) to the component rather than the mixin.

**Alternative considered**: Copy timeboxer's inline input styles. Rejected — duplicate styling, inconsistent with the rest of newapp.

### File structure

```
app/ui/auth-card.tsx          (NEW — AuthShell + AuthForm components)
app/actions/auth-login-controller.tsx  (MODIFIED — uses AuthShell/AuthForm)
app/actions/auth-register-controller.tsx  (MODIFIED — uses AuthShell/AuthForm)
```

## Risks / Trade-offs

**[Dark theme contrast]** → The card uses `theme.surface.lvl1` which in dark mode will be a dark gray. The shadow (`theme.shadow.lg`) may not be visible against a dark background. Timeboxer's design assumes light mode. We accept the shadow being subtle or invisible in dark mode — the border still distinguishes the card.

**[Input style divergence]** → Using newapp's `input.base`/`input.focus` instead of timeboxer's input styles means the auth inputs will match newapp's other forms, not timeboxer's. This is intentional — consistency within newapp takes priority over exact timeboxer fidelity.

**[Single error only]** → newapp controllers only pass a single `error` string. Timeboxer supports per-field errors. The `AuthForm` component includes an `errors` prop for the future, but field-level errors won't be wired yet. This is a known gap — upgrading controllers to do field-level validation would be a separate change.
