import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { frames } from '../routes.ts'
import {
  currentFrameTarget,
  currentRequestTargetsFrame,
  getSelfFrameTarget,
  isFrameTargeted,
  requestFrameTarget,
} from './frame-target.ts'

function requestWithTarget(target: string | null): Pick<Request, 'headers'> {
  let headers = new Headers()
  if (target != null) headers.set('X-Remix-Target', target)
  return { headers }
}

describe('requestFrameTarget', () => {
  it('returns the X-Remix-Target value when present', () => {
    assert.equal(requestFrameTarget(requestWithTarget(frames.adminContent)), 'admin-content')
  })

  it('returns null for a non-frame request', () => {
    assert.equal(requestFrameTarget(requestWithTarget(null)), null)
  })
})

describe('isFrameTargeted', () => {
  it('matches when the request addresses one of the names', () => {
    assert.ok(isFrameTargeted(requestWithTarget(frames.settingsPanel), frames.settingsPanel))
    assert.ok(
      isFrameTargeted(
        requestWithTarget(frames.adminContent),
        frames.settingsPanel,
        frames.adminContent,
      ),
    )
  })

  it('does not match a different target or a plain document request', () => {
    assert.equal(
      isFrameTargeted(requestWithTarget(frames.listsContent), frames.adminContent),
      false,
    )
    assert.equal(isFrameTargeted(requestWithTarget(null), frames.adminContent), false)
  })
})

describe('context-based helpers outside a request context', () => {
  // Unit tests run without an async request context: getContext() throws and
  // the helpers must degrade, not crash the render.
  it('currentFrameTarget returns null', () => {
    assert.equal(currentFrameTarget(), null)
  })

  it('currentRequestTargetsFrame returns false', () => {
    assert.equal(currentRequestTargetsFrame(frames.adminContent), false)
  })

  it('getSelfFrameTarget falls back to the admin content frame', () => {
    assert.equal(getSelfFrameTarget(), frames.adminContent)
  })
})
