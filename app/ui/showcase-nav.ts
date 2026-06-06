/**
 * Adapter layer between the showcase registry and the main navigation.
 *
 * The main nav imports stable, flattened nav data from here rather than
 * depending on internal types and structure of the showcase registry.
 * This insulates nav.ts from registry refactors.
 */

import { SHOWCASE_SECTIONS, SHOWCASE_PAGES } from './showcase-registry.ts'

export type ShowcaseNavItem = {
  label: string
  href: string
}

/** Overview link for the showcase section heading. */
export const SHOWCASE_OVERVIEW: ShowcaseNavItem = {
  label: 'Overview',
  href: '/ui',
}

/** All showcase pages in nav display order, flattened across sections. */
export const SHOWCASE_NAV_ITEMS: ShowcaseNavItem[] =
  SHOWCASE_SECTIONS.flatMap((section) =>
    section.pageIds.map((id) => ({
      label: SHOWCASE_PAGES[id].navLabel ?? SHOWCASE_PAGES[id].label,
      href: SHOWCASE_PAGES[id].path,
    })),
  )
