import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import type { Handle } from 'remix/ui'
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

  it('renders sortable column headers', () => {
    let renderFn = ClientGridPage(
      makeHandle({ rows: sampleRows, offset: 0, hasPrev: false, hasNext: true }),
    )
    let tree = renderFn()

    assert.ok(tree, 'should produce a tree')
    assert.ok(treeContainsText(tree, 'Name'), 'should have Name column')
    assert.ok(treeContainsText(tree, 'Email'), 'should have Email column')
    assert.ok(treeContainsText(tree, 'Role'), 'should have Role column')
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

  it('renders edit links for each row', () => {
    let renderFn = ClientGridPage(
      makeHandle({ rows: sampleRows, offset: 0, hasPrev: false, hasNext: true }),
    )
    let tree = renderFn()

    assert.ok(treeContainsText(tree, 'Edit'), 'should have Edit buttons')
  })

  it('shows empty state when no rows', () => {
    let renderFn = ClientGridPage(
      makeHandle({ rows: [], offset: 0, hasPrev: false, hasNext: false }),
    )
    let tree = renderFn()

    assert.ok(treeContainsText(tree, 'No client records'), 'should show empty state')
  })

  it('renders a search button for filtering', () => {
    let renderFn = ClientGridPage(
      makeHandle({ rows: sampleRows, offset: 0, hasPrev: false, hasNext: true }),
    )
    let tree = renderFn()

    assert.ok(treeContainsText(tree, 'Search'), 'should have Search button')
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

  it('marks the "Add New" link with data-rmx-document to escape frame interception', () => {
    let renderFn = ClientGridPage(
      makeHandle({ rows: sampleRows, offset: 0, hasPrev: false, hasNext: true }),
    )
    let tree = renderFn()

    let links = findElementsWithProp(tree, 'data-rmx-document')
    assert.ok(links.length >= 1, 'should render at least one data-rmx-document link')
    assert.ok(
      treeContainsText(tree, 'Add New'),
      'the data-rmx-document escape should be on the Add New link',
    )
  })
})
