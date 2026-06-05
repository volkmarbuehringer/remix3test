## Context

The register page (`auth-register/controller.tsx`) and reset password page (`auth-forgotten/controller.tsx`) use plain `<input type="password">` fields. There is no password confirmation on registration and no way to toggle visibility on any password field. Both pages use the shared `AuthShell`/`AuthForm` components from `app/ui/auth-card.tsx`.

Remix 3 client-side interactivity uses `clientEntry(import.meta.url, ...)` wrapped components with `on('click', handler)` mixins for event handling and the `Handle` object for state management. The `ref` function from `remix/ui` provides access to DOM elements within client entries.

## Goals / Non-Goals

**Goals:**
- Add a "Confirm password" field to the register form that visually and programmatically validates matching passwords before submission
- Add a visibility toggle button (eye/eye-off icon) to all password fields: register password, register confirm password, reset password form
- Use a reusable `PasswordField` component to avoid duplicating toggle logic
- No new external dependencies — use inline SVG for icons, existing theme tokens for styling

**Non-Goals:**
- Password strength meter or requirements indicator
- Changing the login page's password field (no confirmation needed there and visibility is less critical)
- Changing the admin user creation password field in `admin-users-page.tsx`
- Server-side password confirmation validation (only password field is sent to the server; confirmation is client-side only)

## Decisions

### Decision 1: Reusable `PasswordField` component in `app/ui/auth-card.tsx`

Create a `PasswordField` clientEntry component that encapsulates the password input + visibility toggle button. This avoids copy-pasting toggle logic across register and reset pages.

**Alternatives considered:**
- Inline toggle button in each page — rejected to avoid duplication
- Pure CSS/JS approach without clientEntry — rejected because Remix 3 requires clientEntry for DOM manipulation

### Decision 2: Visibility toggle via `ref` + `on('click')` pattern

Use Remix 3's `ref` to access the input element and toggle `type` between `password` and `text` on button click. Use `handle.update()` to trigger re-render after state changes.

The component will accept the same props as a password input plus `error` for inline field error display.

### Decision 3: Inline SVG icons for eye/eye-off

Use two simple inline SVG paths for the eye and eye-off icons rather than importing an icon library. The SVGs use `currentColor` for theme-compatible coloring.

### Decision 4: Client-side confirmation validation only

The confirm password field validates matching on the client side via a `handle.onsubmit` interceptor or by disabling the submit button when passwords don't match. The server only receives and validates the primary `password` field. This avoids unnecessary server round-trips.

**Alternatives considered:**
- Server-side confirmation — rejected because it adds no security benefit (the server never needs to see the confirmation value)
- `confirmPassword` schema field — rejected to keep the schema simple and avoid sending redundant data

### Decision 5: Confirmation feedback inline below the confirm field

When passwords don't match, show a visual hint (error-colored text) below the confirm password field. This provides immediate feedback without blocking form submission entirely.

## Risks / Trade-offs

- [Risk] The `ref` approach might add complexity if Remix 3 changes its client entry internals → **Mitigation**: follow existing `ref` usage patterns from admin-appointments-context-menu and other client entries
- [Trade-off] Client-side only validation means the user could bypass it with devtools → **Mitigation**: acceptable because the server validates the single password field; confirm mismatch only prevents typos, not security attacks
- [Trade-off] Adding a clientEntry component to auth-card.tsx means the file grows beyond its current "mostly CSS + static components" role → **Mitigation**: if the file gets too large, extract PasswordField to its own file later
