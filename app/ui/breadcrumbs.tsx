import { Breadcrumbs } from 'remix/components/breadcrumbs'
import type { BreadcrumbItem } from 'remix/components/breadcrumbs'

import { ROUTE_LABELS } from '../route-labels.ts'

export { Breadcrumbs }
export type { BreadcrumbItem }

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
