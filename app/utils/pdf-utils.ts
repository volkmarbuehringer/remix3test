import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import pdfmake from 'pdfmake'
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { SuperHeaders } from 'remix/headers'

let initialized = false

function ensureFonts() {
  if (initialized) return
  pdfmake.setUrlAccessPolicy(() => false)
  let dir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../node_modules/pdfmake/fonts/Roboto',
  )
  pdfmake.setLocalAccessPolicy((fp: string) => fp.startsWith(dir))
  pdfmake.setFonts({
    Roboto: {
      normal: path.join(dir, 'Roboto-Regular.ttf'),
      bold: path.join(dir, 'Roboto-Medium.ttf'),
      italics: path.join(dir, 'Roboto-Italic.ttf'),
      bolditalics: path.join(dir, 'Roboto-MediumItalic.ttf'),
    },
  })
  initialized = true
}

export async function generatePdfBuffer(docDef: TDocumentDefinitions): Promise<Buffer> {
  ensureFonts()
  let doc = pdfmake.createPdf({
    defaultStyle: { font: 'Roboto' },
    ...docDef,
  })
  return await doc.getBuffer()
}

/**
 * Wrap a PDF buffer as an attachment-download Response with the standard
 * headers (Content-Type, Content-Disposition, Content-Length) used by the
 * verwaltung PDF export routes.
 */
export function pdfAttachmentResponse(buffer: Buffer, filename: string): Response {
  let headers = new SuperHeaders()
  headers.contentType = 'application/pdf'
  headers.contentDisposition = { type: 'attachment', filename }
  headers.contentLength = buffer.length
  return new Response(new Uint8Array(buffer), { headers })
}
