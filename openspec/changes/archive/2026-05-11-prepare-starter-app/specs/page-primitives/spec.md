## ADDED Requirements

### Requirement: PageSection component

The app SHALL export a `PageSection` component from `app/ui/page-primitives.tsx` that renders a section with an optional title and description above children content. The title SHALL use `theme.fontSize.xl` and `theme.fontWeight.semibold`. The description SHALL use `theme.fontSize.sm` and `theme.colors.text.secondary`. The section SHALL use vertical flex layout with `theme.space.lg` gap between header and children.

#### Scenario: PageSection renders title and description

- **WHEN** rendering `<PageSection title="Hello" description="World"><p>content</p></PageSection>`
- **THEN** the output SHALL contain a heading with "Hello", a paragraph with "World" styled as description, and the content paragraph

### Requirement: ShowcaseLinkCard component

The app SHALL export a `ShowcaseLinkCard` component from `app/ui/page-primitives.tsx` that renders a navigable card with title, description, eyebrow label, and a chevron action indicator. The card SHALL have hover effects (translation, shadow, border-color change).

#### Scenario: ShowcaseLinkCard renders as anchor

- **WHEN** rendering `<ShowcaseLinkCard href="/page" title="Title" description="Desc" eyebrow="Section" />`
- **THEN** the output SHALL be an `<a>` element with href="/page" containing the eyebrow, title, and description text

### Requirement: Shared CSS primitives

The `app/ui/page-primitives.tsx` module SHALL export the following CSS values for use across pages:

- `panelCss` — consistent card surface with border, border-radius, background, padding, box-shadow
- `panelInsetCss` — variant with inset/lower background level
- `panelElevatedCss` — variant with elevated shadow
- `pageStackCss` — vertical flex layout with `theme.space.xxl` gap for page-level stacking
- `featureGridCss` — vertical flex layout with `theme.space.lg` gap for feature sections
- `exampleGridCss` — vertical flex layout with `theme.space.lg` gap for examples
- `bodyTextCss` — base body copy styling (sm font-size, relaxed line-height, secondary color)
- `eyebrowTextCss` — uppercase label styling (xxxs font-size, semibold, meta letter-spacing, muted color)
- `panelTitleTextCss` — card title styling (lg font-size, tight line-height, semibold, primary color)
- `panelDescriptionTextCss` — card description styling (sm font-size, relaxed line-height, secondary color)
- `captionTextCss` — small caption text (xs font-size, normal line-height, muted color)

#### Scenario: pageStackCss creates consistent page rhythm

- **WHEN** two page sections are wrapped in `<div mix={pageStackCss}>`
- **THEN** each section SHALL have `theme.space.xxl` gap between them

#### Scenario: panelCss creates consistent card surface

- **WHEN** a `<div mix={panelCss}>` is rendered
- **THEN** it SHALL have consistent background, border, border-radius, padding, and box-shadow from theme tokens
