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
    assert.ok(treeContainsText(tree, 'Kunde bearbeiten'), 'should have edit heading')
    assert.ok(treeContainsText(tree, '42'), 'should show row ID in badge')
  })

  it('renders a save button', () => {
    let renderFn = ClientEditPage(
      makeHandle({ row: sampleRow, offset: '0', sort: '', order: 'asc' }),
    )
    let tree = renderFn()

    assert.ok(treeContainsText(tree, 'Speichern'), 'should have submit button')
  })

  it('renders a cancel link back to client list', () => {
    let renderFn = ClientEditPage(
      makeHandle({ row: sampleRow, offset: '20', sort: 'name', order: 'asc' }),
    )
    let tree = renderFn()

    assert.ok(treeContainsText(tree, 'Abbrechen'), 'should have cancel button')
  })

  it('renders all form fields (name, email, role, status, registered)', () => {
    let renderFn = ClientEditPage(
      makeHandle({ row: sampleRow, offset: '0', sort: '', order: 'asc' }),
    )
    let tree = renderFn()

    assert.ok(treeContainsText(tree, 'Name'), 'should show Name label')
    assert.ok(treeContainsText(tree, 'E-Mail'), 'should show E-Mail label')
    assert.ok(treeContainsText(tree, 'Rolle'), 'should show Rolle label')
    assert.ok(treeContainsText(tree, 'Status'), 'should show Status label')
    assert.ok(treeContainsText(tree, 'Registriert'), 'should show Registriert label')
  })

  it('does not nest a button inside the cancel link (invalid HTML)', () => {
    let renderFn = ClientEditPage(
      makeHandle({ row: sampleRow, offset: '0', sort: '', order: 'asc' }),
    )
    let tree = renderFn()

    assert.equal(
      hasButtonInsideAnchor(tree),
      false,
      'links must not wrap buttons; style the anchor itself',
    )
  })
})
