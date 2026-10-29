import { ContentDisposition } from 'remix/headers'

/**
 * Build an attachment `Content-Disposition` for a user-supplied file name.
 *
 * Uploaded names are untrusted metadata, so the plain `filename` parameter is
 * kept ASCII-only and non-ASCII names are carried in the RFC 8187 `filename*`
 * parameter. `ContentDisposition` handles quoting/escaping; CR/LF are stripped
 * here so the name cannot inject a header.
 */
export function attachmentDisposition(filename: string): string {
  let cleanFilename = filename.replace(/[\r\n]/g, '')
  let asciiFilename = cleanFilename.replace(/[^\x20-\x7E]/g, '_')

  if (asciiFilename === cleanFilename) {
    return new ContentDisposition({ type: 'attachment', filename: cleanFilename }).toString()
  }

  return new ContentDisposition({
    type: 'attachment',
    filename: asciiFilename,
    filenameSplat: `UTF-8''${encodeRfc8187(cleanFilename)}`,
  }).toString()
}

/** Percent-encode the characters RFC 8187 allows in an ext-value. */
function encodeRfc8187(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}
