import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import pdfmake from 'pdfmake'
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'

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
