import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { MAIN_RELEASE_TAG_RE, releaseAssetUrlRe } from './preview-release-tag.ts'

const OLD_TAG = 'v0.20261117.0-main-ab790c88'
const OLD_TIMESTAMP_TAG = 'v0.20261113.215858-main-848e2fbe'
const NEW_TAG = 'v0.0.20261117-main-9cbc5144'

describe('preview release tags', () => {
  it('accepts both main tag formats and captures the source sha', () => {
    assert.equal(MAIN_RELEASE_TAG_RE.exec(OLD_TAG)?.[1], 'ab790c88')
    assert.equal(MAIN_RELEASE_TAG_RE.exec(OLD_TIMESTAMP_TAG)?.[1], '848e2fbe')
    assert.equal(MAIN_RELEASE_TAG_RE.exec(NEW_TAG)?.[1], '9cbc5144')
  })

  it('rejects PR, experimental, and malformed tags', () => {
    for (let tag of [
      'v0.20261103.0-pr-123',
      'v0.20261103.0-experimental-abcdef12',
      'v0.0.20261103-pr-123',
      'v0.0.20261103-experimental-abcdef12',
      'v0.0.20261103-main-abcdef1',
      'v0.0.20261103-main-notasha',
      'v0.0.2026110-main-abcdef12',
      'v0.1.20261103-main-abcdef12',
      'v1.0.20261103-main-abcdef12',
      'v0.0.20261103-main-abcdef12 ',
    ]) {
      assert.equal(MAIN_RELEASE_TAG_RE.test(tag), false, tag)
    }
  })

  it('parses release asset URLs for both formats', () => {
    let asset = releaseAssetUrlRe('(?:remix|ui)')
    let oldUrl = `https://github.com/remix-run/previews/releases/download/${OLD_TAG}/remix.tgz`
    let newUrl = `https://github.com/remix-run/previews/releases/download/${NEW_TAG}/ui.tgz`

    assert.deepEqual(oldUrl.match(asset)?.slice(1), [OLD_TAG, 'ab790c88', 'remix'])
    assert.deepEqual(newUrl.match(asset)?.slice(1), [NEW_TAG, '9cbc5144', 'ui'])
  })

  it('rejects URLs for other hosts, packages, or partial tags', () => {
    let asset = releaseAssetUrlRe('(?:remix|ui)')

    assert.equal(asset.test(`https://example.com/releases/download/${NEW_TAG}/remix.tgz`), false)
    assert.equal(
      asset.test(
        `https://github.com/remix-run/previews/releases/download/${NEW_TAG}/component.tgz`,
      ),
      false,
    )
    assert.equal(
      asset.test(`https://github.com/remix-run/previews/releases/download/${NEW_TAG}/remix.tgz\n`),
      false,
    )
  })
})
