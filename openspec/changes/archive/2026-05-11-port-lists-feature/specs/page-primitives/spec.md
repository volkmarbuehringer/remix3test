## MODIFIED Requirements

### Requirement: PageSection component

The app SHALL export a `PageSection` component from `app/ui/page-primitives.tsx` that renders a section with an optional title and description above children content. The title SHALL use `theme.fontSize.xl` and `theme.fontWeight.semibold`. The description SHALL use `theme.fontSize.sm` and `theme.colors.text.secondary`. The section SHALL use vertical flex layout with `theme.space.lg` gap between header and children.

PageSection SHALL be used in real feature pages (not just the showcase), including the lists detail page.

#### Scenario: PageSection renders title and description

- **WHEN** rendering `<PageSection title="Hello" description="World"><p>content</p></PageSection>`
- **THEN** the output SHALL contain a heading with "Hello", a paragraph with "World" styled as description, and the content paragraph

#### Scenario: PageSection used in lists detail page

- **WHEN** rendering the lists detail page at `/lists/:id`
- **THEN** the page SHALL use `<PageSection>` to wrap the list items display
