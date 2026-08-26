import { css, type Handle, type RemixNode } from 'remix/ui'
import type { BreadcrumbItem } from 'remix/ui/breadcrumbs'

import { theme } from '../ui/theme/theme.ts'
import { ROUTE_LABELS } from '../route-labels.ts'

export type { BreadcrumbItem }

// App-owned breadcrumb renderer. The vendor `remix/ui/breadcrumbs` component
// styles its items with hardcoded `light-dark(...)` pixel values that resolve
// from the OS `prefers-color-scheme` (via `color-scheme`) rather than the app's
// `data-theme` toggle, so its text becomes unreadable whenever the app theme
// diverges from the OS preference. It also wraps each class in an
// `@layer remix-ui.<class>` block, which makes overrides unreliable. Rendering
// the trail here with the app's theme variables keeps every crumb readable in
// both themes.
const rootCss = css({ minWidth: 0 })

const listCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: `${theme.space.xs} ${theme.space.sm}`,
  minWidth: 0,
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

const itemCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  minWidth: 0,
})

const separatorCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: theme.fontSize.sm,
  height: theme.fontSize.sm,
  color: theme.colors.text.muted,
})

const linkCss = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
  fontWeight: theme.fontWeight.medium,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  '&:hover': {
    color: theme.colors.text.primary,
  },
})

const currentCss = css({
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
  fontWeight: theme.fontWeight.semibold,
  whiteSpace: 'nowrap',
})

const textCss = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
  whiteSpace: 'nowrap',
})

const separator = (
  <svg
    width={theme.fontSize.sm}
    height={theme.fontSize.sm}
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="m6 4 4 4-4 4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
)

export interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  ariaLabel?: string
}

export function Breadcrumbs(handle: Handle<BreadcrumbsProps>): () => RemixNode {
  return () => {
    let { items, ariaLabel } = handle.props
    return (
      <nav aria-label={ariaLabel ?? 'Breadcrumb'} mix={rootCss}>
        <ol mix={listCss}>
          {items.flatMap((item, index) => {
            let isCurrent = index === items.length - 1
            let content = isCurrent ? (
              <span aria-current="page" mix={currentCss}>
                {item.label}
              </span>
            ) : item.href ? (
              <a href={item.href} mix={linkCss}>
                {item.label}
              </a>
            ) : (
              <span mix={textCss}>{item.label}</span>
            )

            let nodes: RemixNode[] = [
              <li key={`item-${index}`} mix={itemCss}>
                {content}
              </li>,
            ]

            if (index < items.length - 1) {
              nodes.push(
                <li key={`separator-${index}`} aria-hidden="true" mix={separatorCss}>
                  {separator}
                </li>,
              )
            }

            return nodes
          })}
        </ol>
      </nav>
    )
  }
}

/**
 * Map a URL pathname to a breadcrumb trail.
 * The last item represents the current page (no href).
 * Labels derive from the centralized ROUTE_LABELS map — adding a new route label
 * automatically extends breadcrumb coverage.
 */
export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  let path = pathname.replace(/\/+$/, '') || '/'

  // Exact match — build hierarchical trail from root segments
  let exactLabel = ROUTE_LABELS[path]
  if (exactLabel) {
    return buildTrail(path, exactLabel)
  }

  // Partial match — walk up to nearest parent path with a label
  let segments = path.split('/').filter(Boolean)
  for (let i = segments.length - 1; i >= 0; i--) {
    let parentPath = '/' + segments.slice(0, i).join('/')
    let parentLabel = ROUTE_LABELS[parentPath]
    if (parentLabel) {
      return buildTrail(parentPath, parentLabel)
    }
  }

  // Fallback
  return [{ label: 'Home' }]
}

function buildTrail(path: string, leafLabel: string): BreadcrumbItem[] {
  if (path === '/') {
    return [{ label: leafLabel }]
  }

  let segments = path.split('/').filter(Boolean)
  let trail: BreadcrumbItem[] = []

  // Accumulate path segments from root to leaf
  let current = ''
  for (let i = 0; i < segments.length; i++) {
    current += '/' + segments[i]
    let label = ROUTE_LABELS[current]
    if (label) {
      let isLast = i === segments.length - 1
      trail.push(isLast ? { label } : { href: current, label })
    }
  }

  return trail
}
