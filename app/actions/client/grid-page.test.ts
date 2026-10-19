import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import type { Handle } from 'remix/component'
import { ClientGridPage } from './grid-page.tsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RemixElement {
  type: string | Function
  props: Record<string, unknown>
  key?: unknown
  $rmx: true
}

function treeContainsText(node: unknown, text: string): boolean {
  if (!node) return false
  if (typeof node === 'string') return node.includes(text)
  if (typeof node === 'number' || typeof node === 'bigint') {
    return String(node).includes(text)
  }
  if (typeof node === 'object' && node !== null) {
    let el = node as RemixElement
    if (el.props?.children) {
      let children = Array.isArray(el.props.children) ? el.props.children : [el.props.children]
      for (let child of children) {
        if (treeContainsText(child, text)) return true
      }
    }
  }
  return false
}

function findElementsWithProp(node: unknown, prop: string, value?: unknown): RemixElement[] {
  let matches: RemixElement[] = []
  if (!node) return matches
  if (typeof node === 'object' && node !== null) {
    let el = node as RemixElement
    if (prop in el.props && (value === undefined || el.props[prop] === value)) {
      matches.push(el)
    }
    if (el.props?.children) {
      let children = Array.isArray(el.props.children) ? el.props.children : [el.props.children]
      for (let child of children) {
        matches.push(...findElementsWithProp(child, prop, value))
      }
    }
  }
  return matches
}

/** True when a <button> is nested inside an <a> — invalid HTML that breaks link semantics. */
function hasButtonInsideAnchor(node: unknown, insideAnchor = false): boolean {
  if (!node || typeof node !== 'object') return false
  if (Array.isArray(node)) {
    return node.some((child) => hasButtonInsideAnchor(child, insideAnchor))
  }
  let el = node as RemixElement
  if (insideAnchor && el.type === 'button') return true
  if (!el.props?.children) return false
  let children = Array.isArray(el.props.children) ? el.props.children : [el.props.children]
  let nested = insideAnchor || el.type === 'a'
  return children.some((child) => hasButtonInsideAnchor(child, nested))
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleRows = [
  {
    id: 1,
    name: 'User 1',
    email: 'user1@example.com',
    role: 'Admin' as const,
    status: 'Active' as const,
    registered: Date.parse('2026-05-01'),
  },
  {
    id: 2,
    name: 'User 2',
    email: 'user2@example.com',
    role: 'Editor' as const,
    status: 'Active' as const,
    registered: Date.parse('2026-04-28'),
  },
  {
    id: 3,
    name: 'User 3',
    email: 'user3@example.com',
    role: 'Viewer' as const,
    status: 'Inactive' as const,
    registered: Date.parse('2026-04-25'),
  },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function makeHandle<P>(props: P): Handle<P> {
  return { id: 'test', props } as unknown as Handle<P>
}

describe('ClientGridPage', () => {
  it('returns a render function', () => {
    let renderFn = ClientGridPage(
      makeHandle({ rows: [], offset: 0, hasPrev: false, hasNext: false }),
    )
    assert.equal(typeof renderFn, 'function')
  })

  it('renders rows with data', () => {
    let renderFn = ClientGridPage(
      makeHandle({ rows: sampleRows, offset: 0, hasPrev: false, hasNext: true }),
    )
    let tree = renderFn()

    assert.ok(tree, 'should produce a tree')
    assert.ok(treeContainsText(tree, 'User 1'), 'should show first user')
    assert.ok(treeContainsText(tree, 'User 3'), 'should show last user')
    assert.ok(treeContainsText(tree, 'user1@example.com'), 'should show email')
    assert.ok(treeContainsText(tree, 'Admin'), 'should show role')
    assert.ok(treeContainsText(tree, 'Inactive'), 'should show status')
  })

  it('renders the UTC registration day for a timestamp near local midnight', () => {
    let lateMidnightRow = {
      ...sampleRows[0]!,
      registered: Date.UTC(2026, 4, 1, 23, 30),
    }
    let renderFn = ClientGridPage(
      makeHandle({ rows: [lateMidnightRow], offset: 0, hasPrev: false, hasNext: false }),
    )
    let tree = renderFn()

    assert.ok(
      treeContainsText(tree, '01.05.2026'),
      'the grid should show the UTC day used by the edit form',
    )
    assert.ok(
      !treeContainsText(tree, '02.05.2026'),
      'the grid must not shift the registration day in local time',
    )
  })

  it('labels every cell for the mobile card layout', () => {
    let renderFn = ClientGridPage(
      makeHandle({ rows: sampleRows, offset: 0, hasPrev: false, hasNext: true }),
    )
    let tree = renderFn()

    let labels = findElementsWithProp(tree, 'data-label').map((el) =>
      String(el.props['data-label']),
    )
    assert.deepEqual(labels.slice(0, 7), [
      'ID',
      'Name',
      'E-Mail',
      'Rolle',
      'Status',
      'Registriert',
      'Aktionen',
    ])
  })

  it('renders sortable column headers', () => {
    let renderFn = ClientGridPage(
      makeHandle({ rows: sampleRows, offset: 0, hasPrev: false, hasNext: true }),
    )
    let tree = renderFn()

    assert.ok(tree, 'should produce a tree')
    assert.ok(treeContainsText(tree, 'Name'), 'should have Name column')
    assert.ok(treeContainsText(tree, 'E-Mail'), 'should have E-Mail column')
    assert.ok(treeContainsText(tree, 'Rolle'), 'should have Rolle column')
    assert.ok(treeContainsText(tree, 'Status'), 'should have Status column')
  })

  it('shows pagination info with correct range', () => {
    let renderFn = ClientGridPage(
      makeHandle({ rows: sampleRows, offset: 0, hasPrev: false, hasNext: true }),
    )
    let tree = renderFn()

    assert.ok(treeContainsText(tree, '1'), 'page start should be 1')
    assert.ok(treeContainsText(tree, '3'), 'page end should be 3')
  })

  it('renders accessible edit/toggle/delete actions for each row', () => {
    let renderFn = ClientGridPage(
      makeHandle({ rows: sampleRows, offset: 0, hasPrev: false, hasNext: true }),
    )
    let tree = renderFn()

    assert.ok(
      findElementsWithProp(tree, 'aria-label', 'Bearbeiten').length >= 1,
      'each row should expose an accessible Bearbeiten action',
    )
    assert.ok(
      findElementsWithProp(tree, 'aria-label', 'Löschen').length >= 1,
      'each row should expose an accessible Löschen action',
    )
  })

  it('shows empty state when no rows', () => {
    let renderFn = ClientGridPage(
      makeHandle({ rows: [], offset: 0, hasPrev: false, hasNext: false }),
    )
    let tree = renderFn()

    assert.ok(treeContainsText(tree, 'Keine Kunden'), 'should show empty state')
  })

  it('renders a search button for filtering', () => {
    let renderFn = ClientGridPage(
      makeHandle({ rows: sampleRows, offset: 0, hasPrev: false, hasNext: true }),
    )
    let tree = renderFn()

    assert.ok(treeContainsText(tree, 'Suchen'), 'should have Suchen button')
  })

  it('marks the GET filter form with data-rmx-history="replace"', () => {
    let renderFn = ClientGridPage(
      makeHandle({ rows: sampleRows, offset: 0, hasPrev: false, hasNext: true }),
    )
    let tree = renderFn()

    let forms = findElementsWithProp(tree, 'method', 'GET')
    assert.equal(forms.length, 1, 'should render exactly one GET form')
    assert.equal(
      forms[0]?.props['data-rmx-history'],
      'replace',
      'filter form should carry data-rmx-history="replace"',
    )
    assert.equal(
      forms[0]?.props['data-rmx-target'],
      'admin-content',
      'filter form should target the admin content frame',
    )
  })

  it('opens the create panel inside the owning frame', () => {
    let renderFn = ClientGridPage(
      makeHandle({ rows: sampleRows, offset: 0, hasPrev: false, hasNext: true }),
    )
    let tree = renderFn()

    // The create link must stay in the hosting frame (admin-content or an agent
    // panel) instead of forcing a full-document navigation that would tear down
    // an enclosing agent page.
    let frameLinks = findElementsWithProp(tree, 'data-rmx-target', 'admin-content')
    assert.ok(frameLinks.length >= 2, 'grid links should target the content frame')
    assert.ok(treeContainsText(tree, 'Neu anlegen'), 'should render the German create label')
    assert.equal(
      findElementsWithProp(tree, 'data-rmx-document').length,
      0,
      'the create link must not escape frame interception',
    )
  })

  it('resets the page offset on status filter tabs and keeps the active sort in search', () => {
    let renderFn = ClientGridPage(
      makeHandle({
        rows: sampleRows,
        offset: 15,
        hasPrev: true,
        hasNext: false,
        sortField: 'name',
        sortOrder: 'desc',
      }),
    )
    let tree = renderFn()

    let hrefs = findElementsWithProp(tree, 'href').map((el) => String(el.props.href))
    assert.ok(
      hrefs.some((href) => href.includes('status=active') && !href.includes('offset=15')),
      'Aktiv tab should reset the offset',
    )
    assert.ok(
      findElementsWithProp(tree, 'name', 'sort').some((el) => el.props.value === 'name'),
      'search form should carry the active sort column',
    )
    assert.ok(
      findElementsWithProp(tree, 'name', 'order').some((el) => el.props.value === 'desc'),
      'search form should carry the active sort direction',
    )
  })

  it('carries the status tab through search, sort, pagination, and row links', () => {
    let renderFn = ClientGridPage(
      makeHandle({
        rows: sampleRows,
        offset: 15,
        hasPrev: true,
        hasNext: true,
        sortField: 'name',
        sortOrder: 'desc',
        filter: 'user',
        status: 'active',
      }),
    )
    let tree = renderFn()
    let hrefs = findElementsWithProp(tree, 'href').map((el) => String(el.props.href))

    assert.ok(
      hrefs.some(
        (href) =>
          href.includes('filter=user') &&
          href.includes('sort=name') &&
          href.includes('status=active'),
      ),
      'status tab links should preserve the search and sort',
    )
    assert.ok(
      hrefs.some((href) => href.includes('offset=30') && href.includes('status=active')),
      'pagination should preserve the status tab',
    )
    assert.ok(
      hrefs.some((href) => href.includes('editing=1') && href.includes('status=active')),
      'edit links should preserve the status tab',
    )
    assert.ok(
      hrefs.some((href) => href.includes('creating=true') && href.includes('status=active')),
      'the create link should preserve the status tab',
    )
    assert.ok(
      hrefs.some(
        (href) =>
          href.includes('filter=user') &&
          !href.includes('status=active') &&
          !href.includes('status=inactive'),
      ),
      'the Alle tab should clear the status but keep the search',
    )
    assert.equal(
      findElementsWithProp(tree, 'name', 'filter')[0]?.props.defaultValue,
      'user',
      'the search form should keep the search text',
    )
    assert.ok(
      findElementsWithProp(tree, 'name', 'status').some((el) => el.props.value === 'active'),
      'the search form should carry the status tab',
    )
  })

  it('keeps an open edit panel through grid navigation', () => {
    let renderFn = ClientGridPage(
      makeHandle({
        rows: sampleRows,
        offset: 15,
        hasPrev: true,
        hasNext: true,
        sortField: 'name',
        sortOrder: 'desc',
        filter: 'user',
        status: 'active',
        editingId: 3,
      }),
    )
    let tree = renderFn()
    let hrefs = findElementsWithProp(tree, 'href').map((el) => String(el.props.href))

    assert.ok(
      hrefs.some((href) => href.includes('status=active') && href.includes('editing=3')),
      'status tabs should keep the open edit panel',
    )
    assert.ok(
      hrefs.some((href) => href.includes('sort=id') && href.includes('editing=3')),
      'sort links should keep the open edit panel',
    )
    assert.ok(
      hrefs.some((href) => href.includes('offset=30') && href.includes('editing=3')),
      'pagination should keep the open edit panel',
    )
    assert.ok(
      hrefs.some(
        (href) =>
          href.includes('status=active') && !href.includes('filter=') && href.includes('editing=3'),
      ),
      'the clear-search link should keep the open edit panel',
    )
    assert.equal(
      findElementsWithProp(tree, 'name', 'editing')[0]?.props.value,
      3,
      'the search form should keep the editing id',
    )
  })

  it('keeps an open create panel through grid navigation', () => {
    let renderFn = ClientGridPage(
      makeHandle({
        rows: sampleRows,
        offset: 15,
        hasPrev: true,
        hasNext: true,
        sortField: 'name',
        sortOrder: 'desc',
        creating: true,
      }),
    )
    let tree = renderFn()
    let hrefs = findElementsWithProp(tree, 'href').map((el) => String(el.props.href))

    assert.ok(
      hrefs.some((href) => href.includes('status=active') && href.includes('creating=true')),
      'status tabs should keep the open create panel',
    )
    assert.ok(
      hrefs.some((href) => href.includes('sort=id') && href.includes('creating=true')),
      'sort links should keep the open create panel',
    )
    assert.ok(
      hrefs.some((href) => href.includes('offset=30') && href.includes('creating=true')),
      'pagination should keep the open create panel',
    )
    assert.equal(
      findElementsWithProp(tree, 'name', 'creating')[0]?.props.value,
      'true',
      'the search form should keep the creating flag',
    )
  })

  it('does not nest a button inside a link (invalid HTML)', () => {
    let renderFn = ClientGridPage(
      makeHandle({ rows: sampleRows, offset: 0, hasPrev: false, hasNext: true }),
    )
    let tree = renderFn()

    assert.equal(
      hasButtonInsideAnchor(tree),
      false,
      'links must not wrap buttons; style the anchor itself',
    )
  })
})
