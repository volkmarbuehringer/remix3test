import type { RemixElement } from 'remix/ui'

export const glyphNames = [
  'add',
  'alert',
  'arrowRight',
  'calendar',
  'chat',
  'check',
  'chevronDown',
  'chevronVertical',
  'chevronUp',
  'chevronRight',
  'clock',
  'close',
  'cog',
  'copy',
  'download',
  'edit',
  'expand',
  'eye',
  'eyeOff',
  'info',
  'menu',
  'moon',
  'open',
  'search',
  'send',
  'shield',
  'spinner',
  'trash',
  'user',
  'zap',
] as const

export type GlyphName = (typeof glyphNames)[number]

type GlyphSymbol = RemixElement

export type GlyphValues = {
  readonly [key in GlyphName]: GlyphSymbol
}

export type GlyphContract = Readonly<Record<GlyphName, { id: string }>>

const DEFAULT_GLYPH_ID_PREFIX = 'rmx-glyph'

export const glyphContract: GlyphContract = Object.freeze(
  createGlyphContract(DEFAULT_GLYPH_ID_PREFIX),
)

function createGlyphIds(idPrefix: string): Record<GlyphName, string> {
  return Object.fromEntries(glyphNames.map((name) => [name, `${idPrefix}-${name}`])) as Record<
    GlyphName,
    string
  >
}

function createGlyphContract(idPrefix: string): GlyphContract {
  let ids = createGlyphIds(idPrefix)

  return Object.freeze(
    Object.fromEntries(
      glyphNames.map((name) => [
        name,
        {
          id: ids[name],
        },
      ]),
    ) as GlyphContract,
  )
}
