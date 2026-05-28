## ADDED Requirements

### Requirement: Button mixin namespace

The app SHALL export a `button` namespace object from `app/ui/mixins/button.ts` containing CSS mixins for at least: `base` (shared button layout and typography), `primary`, `ghost`, `danger`.

Each mixin SHALL use `theme.*` tokens for all values (spacing, colors, border radius, font sizes, etc.) rather than raw CSS values.

#### Scenario: Button namespace is discoverable

- **WHEN** a consumer imports `import { button } from '../../ui/mixins/button.ts'`
- **THEN** TypeScript autocomplete SHALL show `button.base`, `button.primary`, `button.ghost`, `button.danger`

#### Scenario: Button mixins compose via mix prop

- **WHEN** rendering `<div mix={[button.base, button.primary]}>`
- **THEN** the element SHALL have both base layout styles and primary color styles

### Requirement: Card mixin namespace

The app SHALL export a `card` namespace object from `app/ui/mixins/card.ts` containing CSS mixins for at least: `base` (background, border, border-radius, padding).

#### Scenario: Card variant composes shared styles

- **WHEN** a consumer uses `card.base`
- **THEN** the element SHALL have consistent surface background, border, and padding

### Requirement: Input mixin namespace

The app SHALL export an `input` namespace object from `app/ui/mixins/input.ts` containing CSS mixins for at least: `base` (shared input dimensions, border, font), `focus` (focus-visible ring), `error` (error border color).

#### Scenario: Input focus and error variants are separate

- **WHEN** a consumer applies `[input.base, input.focus]`
- **THEN** the input SHALL have base styles plus a focus ring
- **WHEN** a consumer applies `[input.base, input.error]`
- **THEN** the input SHALL have base styles plus an error-colored border

### Requirement: Text mixin namespace

The app SHALL export a `text` namespace object from `app/ui/mixins/text.ts` containing CSS mixins for at least: `heading` (semibold, large), `body` (normal weight, readable size), `muted` (secondary color, small), `label` (semibold, small).

#### Scenario: Text variants cover common page typography

- **WHEN** a consumer uses `text.heading`, `text.body`, `text.muted`, or `text.label`
- **THEN** each SHALL set appropriate font-size, font-weight, color, and line-height using `theme.*` tokens
