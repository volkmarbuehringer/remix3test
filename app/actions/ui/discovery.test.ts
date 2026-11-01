import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { discoverDemoFiles, findDemoFile, getDemoVersion, loadDemoModule } from './discovery.ts'

describe('UI gallery discovery', () => {
  it('discovers the checked-in demos with metadata and stable groups', () => {
    let demos = discoverDemoFiles()
    let filenames = demos.map((demo) => demo.filename)

    assert.ok(filenames.includes('theme/button.demo.tsx'), 'button demo should be discovered')
    assert.ok(filenames.includes('theme/counter.demo.tsx'), 'counter demo should be discovered')
    assert.ok(filenames.includes('theme/glyph.demo.tsx'), 'glyph demo should be discovered')
    assert.ok(
      filenames.includes('page-primitives.demo.tsx'),
      'page primitives demo should be discovered',
    )

    let button = demos.find((demo) => demo.filename === 'theme/button.demo.tsx')
    assert.ok(button, 'button demo should have a record')
    assert.equal(button.title, 'Button')
    assert.equal(button.group, 'Theme')
    assert.ok(button.description?.includes('Größenvarianten'), 'description should be parsed')
    assert.equal(button.order, 10)

    let primitives = demos.find((demo) => demo.filename === 'page-primitives.demo.tsx')
    assert.ok(primitives, 'page primitives demo should have a record')
    assert.equal(primitives.group, 'Allgemein')
  })

  it('resolves only files inside app/ui', () => {
    assert.ok(findDemoFile('theme/button.demo.tsx'), 'a real demo should resolve')
    assert.equal(findDemoFile('../app/routes.ts'), undefined, 'parent traversal must be rejected')
    assert.equal(findDemoFile('/etc/passwd'), undefined, 'absolute paths must be rejected')
    assert.equal(
      findDemoFile('%2e%2e%2fapp%2froutes.ts'),
      undefined,
      'encoded traversal must be rejected',
    )
    assert.equal(findDemoFile('theme/button.ts'), undefined, 'non-demo files must be rejected')
  })

  it('loads the demo default export and exposes a cache-key version', async () => {
    let demo = findDemoFile('theme/button.demo.tsx')
    assert.ok(demo, 'button demo should exist')
    assert.ok(getDemoVersion(demo).length > 0, 'version should be non-empty')

    let component = await loadDemoModule(demo)
    assert.equal(typeof component, 'function', 'default export should be a component function')
  })
})
