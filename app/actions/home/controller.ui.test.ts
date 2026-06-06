import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../router.ts'

// ---------------------------------------------------------------------------
// UI Showcase controller integration tests
// Tests the registry-driven routing for /ui and /ui/:component endpoints.
// ---------------------------------------------------------------------------

describe('UI Showcase controller', () => {
  // -----------------------------------------------------------------------
  // GET /ui — showcase index page
  // -----------------------------------------------------------------------

  it('GET /ui returns the showcase index page', async () => {
    // Arrange
    let url = 'https://remix.run/ui'

    // Act
    let response = await router.fetch(url)

    // Assert
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Components'), 'page should contain "Components" section')
    assert.ok(html.includes('Theme Tokens'), 'page should contain "Theme Tokens" section')
  })

  it('GET /ui lists links to all showcase pages', async () => {
    // Arrange
    let url = 'https://remix.run/ui'

    // Act
    let response = await router.fetch(url)
    let html = await response.text()

    // Assert
    assert.ok(html.includes('/ui/button'), 'should link to button showcase')
    assert.ok(html.includes('/ui/form'), 'should link to form showcase')
    assert.ok(html.includes('/ui/theme'), 'should link to theme showcase')
  })

  // -----------------------------------------------------------------------
  // GET /ui/:component — known showcase pages
  // -----------------------------------------------------------------------

  it('GET /ui/button returns 200 with button showcase', async () => {
    // Arrange
    let url = 'https://remix.run/ui/button'

    // Act
    let response = await router.fetch(url)

    // Assert
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Button'), 'page should contain "Button"')
  })

  it('GET /ui/form returns 200 with form showcase', async () => {
    // Arrange
    let url = 'https://remix.run/ui/form'

    // Act
    let response = await router.fetch(url)

    // Assert
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Input'), 'page should contain "Input"')
  })

  it('GET /ui/theme returns 200 with theme showcase', async () => {
    // Arrange
    let url = 'https://remix.run/ui/theme'

    // Act
    let response = await router.fetch(url)

    // Assert
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Theme Tokens'), 'page should contain "Theme Tokens"')
  })

  // -----------------------------------------------------------------------
  // GET /ui/:component — unknown slug returns 404
  // -----------------------------------------------------------------------

  it('GET /ui/nonexistent returns 404', async () => {
    // Arrange
    let url = 'https://remix.run/ui/nonexistent'

    // Act
    let response = await router.fetch(url)

    // Assert
    assert.equal(response.status, 404)
    let text = await response.text()
    assert.equal(text, 'Not Found')
  })

  it('GET /ui/invalid-slug-123 returns 404', async () => {
    // Arrange
    let url = 'https://remix.run/ui/invalid-slug-123'

    // Act
    let response = await router.fetch(url)

    // Assert
    assert.equal(response.status, 404)
    let text = await response.text()
    assert.equal(text, 'Not Found')
  })
})
