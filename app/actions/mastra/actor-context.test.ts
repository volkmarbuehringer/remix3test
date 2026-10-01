import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { RequestContext } from '@mastra/core/request-context'

import { createActorRequestContext, requireActorId } from './actor-context.ts'

describe('actor-context', () => {
  it('requireActorId returns the id set by createActorRequestContext', () => {
    assert.equal(requireActorId(createActorRequestContext(42)), 42)
  })

  it('keeps separate request contexts isolated', () => {
    let first = createActorRequestContext(1)
    let second = createActorRequestContext(2)
    assert.equal(requireActorId(first), 1)
    assert.equal(requireActorId(second), 2)
    assert.equal(requireActorId(first), 1)
  })

  it('throws when the actor id is missing', () => {
    assert.throws(() => requireActorId(undefined), /Not authenticated/)
    assert.throws(() => requireActorId(new RequestContext()), /Not authenticated/)
  })
})
