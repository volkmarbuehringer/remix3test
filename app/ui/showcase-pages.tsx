import { css, type Handle, type RemixNode } from 'remix/ui'
import { theme } from '../lib/theme.ts'

import { Button } from 'remix/components/button'
import { SHOWCASE_SECTIONS, SHOWCASE_PAGES } from './showcase-registry.ts'
import { input } from './mixins/input.ts'
import {
  exampleGridCss,
  PageSection,
  pageStackCss,
  ShowcaseLinkCard,
} from './page-primitives.tsx'

// ── Index page ──

export function ShowcaseIndexPage() {
  return () => (
    <div mix={pageStackCss}>
      {SHOWCASE_SECTIONS.map((section) => (
        <PageSection key={section.id} title={section.label}>
          <div mix={exampleGridCss}>
            {section.pageIds.map((id) => {
              let page = SHOWCASE_PAGES[id]
              return (
                <ShowcaseLinkCard
                  key={id}
                  eyebrow={page.eyebrow}
                  title={page.label}
                  description={page.description}
                  href={page.path}
                />
              )
            })}
          </div>
        </PageSection>
      ))}
    </div>
  )
}

// ── Button page ──

export function ShowcaseButtonPage() {
  return () => (
    <div mix={pageStackCss}>
      <PageSection title="Button" description="Primary, ghost, and danger button variants.">
        <div mix={exampleGridCss}>
          <ExamplePreview code={'<Button tone="primary">Create</Button>'}>
            <Button tone="primary">Create</Button>
          </ExamplePreview>
          <ExamplePreview code={'<Button tone="ghost">Cancel</Button>'}>
            <Button tone="ghost">Cancel</Button>
          </ExamplePreview>
          <ExamplePreview code={'<Button tone="danger">Delete</Button>'}>
            <Button tone="danger">Delete</Button>
          </ExamplePreview>
        </div>
      </PageSection>
    </div>
  )
}

// ── Form page ──

export function ShowcaseFormPage() {
  return () => (
    <div mix={pageStackCss}>
      <PageSection title="Input" description="Text input with base, focus, and error states.">
        <div mix={exampleGridCss}>
          <ExamplePreview code={'<input class={[input.base, input.focus]} />'}>
            <input
              placeholder="Default input"
              mix={[input.base, input.focus, css({ maxWidth: '20rem' })]}
            />
          </ExamplePreview>
          <ExamplePreview code={'<input class={[input.base, input.error]} />'}>
            <input
              placeholder="Error state"
              mix={[input.base, input.error, css({ maxWidth: '20rem' })]}
              defaultValue="invalid@"
            />
          </ExamplePreview>
        </div>
      </PageSection>
    </div>
  )
}

// ── Theme page ──

export function ShowcaseThemePage() {
  return () => (
    <div mix={pageStackCss}>
      <PageSection title="Theme Tokens" description="Semantic tokens used throughout the app.">
        <div mix={exampleGridCss}>
          <TokenSection title="Surface Levels">
            {(['lvl0', 'lvl1', 'lvl2', 'lvl3', 'lvl4'] as const).map((level) => (
              <TokenSwatch key={level} label={`surface.${level}`} color={`var(--rmx-surface-${level})`} />
            ))}
          </TokenSection>
          <TokenSection title="Text Colors">
            {(['primary', 'secondary', 'muted', 'link'] as const).map((tone) => (
              <TokenSwatch key={tone} label={`colors.text.${tone}`} color={`var(--rmx-color-text-${tone})`} />
            ))}
          </TokenSection>
          <TokenSection title="Status Surfaces">
            {(['dangerBg', 'dangerText', 'dangerBorder', 'successBg', 'successText', 'successBorder'] as const).map((token) => (
              <TokenSwatch key={token} label={`surface.${token}`} color={`var(--rmx-surface-${token})`} />
            ))}
          </TokenSection>
        </div>
      </PageSection>
    </div>
  )
}

// ── Helper components ──

interface ExamplePreviewProps { children: RemixNode; code: string }
function ExamplePreview(handle: Handle<ExamplePreviewProps>) {
  return () => {
    let { children, code } = handle.props
    return (
      <div mix={exampleBlockCss}>
        <div mix={exampleSurfaceCss}>{children}</div>
        <pre mix={exampleCodeCss}>{code}</pre>
      </div>
    )
  }
}

interface TokenSectionProps { children: RemixNode; title: string }
function TokenSection(handle: Handle<TokenSectionProps>) {
  return () => {
    let { children, title } = handle.props
    return (
      <div mix={tokenSectionCss}>
        <h3 mix={tokenSectionTitleCss}>{title}</h3>
        <div mix={tokenGridCss}>{children}</div>
      </div>
    )
  }
}

interface TokenSwatchProps { label: string; color: string }
function TokenSwatch(handle: Handle<TokenSwatchProps>) {
  return () => {
    let { label, color } = handle.props
    return (
      <div mix={tokenSwatchCss}>
        <span mix={tokenSwatchColorCss} style={{ background: color }} />
        <span mix={tokenLabelCss}>{label}</span>
        <span mix={tokenValueCss}>{color}</span>
      </div>
    )
  }
}

// ── CSS ──

const exampleBlockCss = css({
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  overflow: 'hidden',
})

const exampleSurfaceCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  minHeight: '60px',
  padding: theme.space.lg,
  background: theme.surface.lvl0,
})

const exampleCodeCss = css({
  margin: 0,
  padding: theme.space.md,
  background: theme.surface.lvl1,
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  fontSize: theme.fontSize.xs,
  fontFamily: theme.fontFamily.mono,
  color: theme.colors.text.secondary,
  overflowX: 'auto',
})

const tokenSectionCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

const tokenSectionTitleCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const tokenGridCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

const tokenSwatchCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  padding: theme.space.sm,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl1,
})

const tokenSwatchColorCss = css({
  width: '24px',
  height: '24px',
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.colors.border.subtle}`,
  flexShrink: 0,
})

const tokenLabelCss = css({
  fontSize: theme.fontSize.xs,
  fontFamily: theme.fontFamily.mono,
  color: theme.colors.text.primary,
})

const tokenValueCss = css({
  fontSize: theme.fontSize.xxs,
  fontFamily: theme.fontFamily.mono,
  color: theme.colors.text.muted,
})
