import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { messagesGridHref } from './messages-grid-url.ts'

describe('messagesGridHref', () => {
  it('omits the default grid state', () => {
    assert.equal(messagesGridHref(0, 'created_at', 'desc'), '/admin/messages')
    assert.equal(messagesGridHref(0, 'created_at', 'asc'), '/admin/messages?order=asc')
  })

  it('keeps a non-default sort, filter and offset', () => {
    assert.equal(
      messagesGridHref(20, 'sender_name', 'desc', 'hello world'),
      '/admin/messages?offset=20&sort=sender_name&filter=hello+world',
    )
  })

  it('round-trips characters that need URL encoding', () => {
    assert.equal(
      messagesGridHref(0, 'content', 'desc', 'a&b=c'),
      '/admin/messages?sort=content&filter=a%26b%3Dc',
    )
  })
})
