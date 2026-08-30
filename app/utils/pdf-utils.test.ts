import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { pdfAttachmentResponse } from './pdf-utils.ts'

describe('pdfAttachmentResponse', () => {
  it('returns a PDF attachment response with correct headers', () => {
    let buffer = Buffer.from('%PDF-test-bytes')
    let response = pdfAttachmentResponse(buffer, 'test-export-2026_01.pdf')

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'application/pdf')
    assert.match(response.headers.get('Content-Disposition') ?? '', /attachment/)
    assert.match(response.headers.get('Content-Disposition') ?? '', /test-export-2026_01\.pdf/)
    assert.equal(response.headers.get('Content-Length'), String(buffer.length))
  })

  it('wraps the buffer bytes unchanged', async () => {
    let buffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x01])
    let response = pdfAttachmentResponse(buffer, 'x.pdf')
    let bytes = new Uint8Array(await response.arrayBuffer())
    assert.deepEqual(Array.from(bytes), [0x25, 0x50, 0x44, 0x46, 0x01])
  })
})
