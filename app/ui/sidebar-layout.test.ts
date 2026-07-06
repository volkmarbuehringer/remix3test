import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { createSidebarLayout } from './sidebar-layout.tsx'
import { renderAdminPage, AdminLayout } from './admin-layout.tsx'

// ---------------------------------------------------------------------------
// Factory contract tests
// Verifies that createSidebarLayout returns the expected shape.
// ---------------------------------------------------------------------------

describe('createSidebarLayout', () => {
  it('returns renderPage, Layout, and isFrameRequest', () => {
    let result = createSidebarLayout({
      frameTarget: 'test-content',
      navGroups: [],
      navIcon: () => null,
      headerIcon: null,
      headerLabel: 'Test',
    })

    assert.equal(typeof result.renderPage, 'function')
    assert.ok(result.Layout, 'Layout should be defined')
    assert.equal(typeof result.isFrameRequest, 'function')
  })

  it('uses headerLabel in config', () => {
    let result = createSidebarLayout({
      frameTarget: 'section-content',
      navGroups: [],
      navIcon: () => null,
      headerIcon: null,
      headerLabel: 'Custom Label',
    })

    // The headerLabel is used internally by the Layout component
    // Verify the factory doesn't throw and returns the expected shape
    assert.equal(typeof result.renderPage, 'function')
  })

  it('accepts nav groups with items', () => {
    type TestId = 'item1' | 'item2'

    let result = createSidebarLayout<TestId>({
      frameTarget: 'test-content',
      navGroups: [
        {
          items: [
            { id: 'item1', label: 'Item 1', href: '/item1' },
            { id: 'item2', label: 'Item 2', href: '/item2' },
          ],
        },
      ],
      navIcon: () => null,
      headerIcon: null,
      headerLabel: 'Test',
    })

    assert.equal(typeof result.renderPage, 'function')
    assert.ok(result.Layout)
  })

  it('accepts nav groups with mixed iframeNav settings', () => {
    type TestId = 'frame' | 'document'

    let result = createSidebarLayout<TestId>({
      frameTarget: 'test-content',
      navGroups: [
        {
          items: [
            { id: 'frame', label: 'Frame Nav', href: '/frame' },
            { id: 'document', label: 'Document Nav', href: '/doc', iframeNav: false },
          ],
        },
      ],
      navIcon: () => null,
      headerIcon: null,
      headerLabel: 'Test',
    })

    assert.equal(typeof result.renderPage, 'function')
  })

  it('accepts sidebarExtras', () => {
    let result = createSidebarLayout({
      frameTarget: 'test-content',
      navGroups: [],
      navIcon: () => null,
      headerIcon: null,
      headerLabel: 'Test',
      sidebarExtras: null,
    })

    assert.equal(typeof result.renderPage, 'function')
    assert.ok(result.Layout)
  })
})

// ---------------------------------------------------------------------------
// Admin layout export consistency
// Verifies that admin-layout.tsx still exports the expected API.
// ---------------------------------------------------------------------------

describe('Admin layout exports', () => {
  it('exports renderAdminPage as a function', () => {
    assert.equal(typeof renderAdminPage, 'function')
  })

  it('exports AdminLayout component', () => {
    assert.ok(AdminLayout, 'AdminLayout should be defined')
  })
})


