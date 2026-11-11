import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { compressResponse } from 'remix/response/compress'

// The app installs compression() in app/middleware/root.ts. Since remix
// #12271/#12273 Vary keeps the spelling a header name was first given and a
// wildcard stays valid. This guards the Safari-relevant case (Safari varies a
// cached response by cookie only when the name is spelled `Cookie`) if the app
// ever starts setting Vary itself, and the wildcard serialization compression()
// relies on.
function request(): Request {
  return new Request('http://localhost/assets/app.js', {
    headers: { 'Accept-Encoding': 'gzip' },
  })
}

function response(vary: string): Response {
  return new Response('x'.repeat(2048), {
    headers: { 'Content-Type': 'text/plain', Vary: vary },
  })
}

describe('compression Vary header', () => {
  it('preserves the spelling of an existing Vary name', async () => {
    let compressed = await compressResponse(response('Cookie'), request())
    assert.equal(compressed.headers.get('Vary'), 'Cookie, Accept-Encoding')
  })

  it('serializes a wildcard Vary as *', async () => {
    let compressed = await compressResponse(response('*'), request())
    assert.equal(compressed.headers.get('Vary'), '*')
  })
})
