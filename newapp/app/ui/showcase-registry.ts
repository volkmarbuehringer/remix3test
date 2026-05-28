import type { RemixNode } from 'remix/ui'

import { ShowcaseButtonPage, ShowcaseFormPage, ShowcaseThemePage } from './showcase-pages.tsx'

// ── Types ──

export type ShowcasePageId = 'button' | 'form' | 'theme'
export type ShowcaseSectionId = 'components' | 'theme'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShowcaseComponent = (handle?: any) => () => RemixNode

export type ShowcasePageEntry = {
  description: string
  eyebrow: string
  label: string
  navLabel?: string
  path: string
  render: ShowcaseComponent
  sectionId: ShowcaseSectionId
}

export type ShowcaseSection = {
  id: ShowcaseSectionId
  label: string
  pageIds: ReadonlyArray<ShowcasePageId>
}

// ── Sections ──

export const SHOWCASE_SECTIONS = [
  { id: 'components', label: 'Components', pageIds: ['button', 'form'] as const },
  { id: 'theme', label: 'Theme Tokens', pageIds: ['theme'] as const },
] as const satisfies ReadonlyArray<ShowcaseSection>

// ── Page registry ──

export const SHOWCASE_PAGES: Record<ShowcasePageId, ShowcasePageEntry> = {
  button: {
    render: ShowcaseButtonPage,
    description: 'Primary, ghost, and danger variants.',
    eyebrow: 'Component',
    label: 'Button',
    path: '/ui/button',
    sectionId: 'components',
  },
  form: {
    render: ShowcaseFormPage,
    description: 'Input fields, focus states, and error states.',
    eyebrow: 'Component',
    label: 'Form',
    path: '/ui/form',
    sectionId: 'components',
  },
  theme: {
    render: ShowcaseThemePage,
    description: 'Surface levels, colors, spacing, and typography.',
    eyebrow: 'Theme',
    label: 'Theme Tokens',
    path: '/ui/theme',
    sectionId: 'theme',
  },
}
