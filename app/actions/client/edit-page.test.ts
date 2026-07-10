import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import type { Handle } from 'remix/ui'
import { ClientEditPage } from './edit-page.tsx'

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

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleRow = {
  id: 42,
  name: 'Jane Doe',
  email: 'jane@example.com',
  role: 'Editor' as const,
  status: 'Active' as const,
  registered: Date.parse('2026-03-15'),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function makeHandle<P>(props: P): Handle<P> {
  return { id: 'test', props } as unknown as Handle<P>
}

describe('ClientEditPage', () => {
  it('returns a render function', () => {
    let renderFn = ClientEditPage(
      makeHandle({ row: sampleRow, offset: '20', sort: 'name', order: 'asc' }),
    )
    assert.equal(typeof renderFn, 'function')
  })

  it('renders the edit form with row data', () => {
    let renderFn = ClientEditPage(
      makeHandle({ row: sampleRow, offset: '20', sort: 'name', order: 'asc' }),
    )
    let tree = renderFn()

    assert.ok(tree, 'should produce a tree')
    assert.ok(treeContainsText(tree, 'Edit Record'), 'should have Edit Record heading')
    assert.ok(treeContainsText(tree, '42'), 'should show row ID in badge')
  })

  it('renders a save button', () => {
    let renderFn = ClientEditPage(
      makeHandle({ row: sampleRow, offset: '0', sort: '', order: 'asc' }),
    )
    let tree = renderFn()

    assert.ok(treeContainsText(tree, 'Save Changes'), 'should have submit button')
  })

  it('renders a cancel link back to client list', () => {
    let renderFn = ClientEditPage(
      makeHandle({ row: sampleRow, offset: '20', sort: 'name', order: 'asc' }),
    )
    let tree = renderFn()

    assert.ok(treeContainsText(tree, 'Cancel'), 'should have cancel button')
  })

  it('renders all form fields (name, email, role, status, registered)', () => {
    let renderFn = ClientEditPage(
      makeHandle({ row: sampleRow, offset: '0', sort: '', order: 'asc' }),
    )
    let tree = renderFn()

    assert.ok(treeContainsText(tree, 'Name'), 'should show Name label')
    assert.ok(treeContainsText(tree, 'Email'), 'should show Email label')
    assert.ok(treeContainsText(tree, 'Role'), 'should show Role label')
    assert.ok(treeContainsText(tree, 'Status'), 'should show Status label')
    assert.ok(treeContainsText(tree, 'Registered'), 'should show Registered label')
  })
})
