import { createElement } from 'remix/ui'
import type { RemixNode } from 'remix/ui'

import type { GlyphValues } from '../../glyph-contract.ts'

const defaultViewBox = '0 0 16 16'

function symbol(...content: RemixNode[]) {
  return createElement('symbol', { viewBox: defaultViewBox }, ...content)
}

export const glyphValues: GlyphValues = {
  add: symbol(
    createElement('path', {
      d: 'M8 3.25v9.5M3.25 8h9.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  ),
  alert: symbol(
    createElement('path', {
      d: 'M8 2.5 13.75 12.5H2.25Z',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'M8 5.75v3.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeWidth: '1.5',
    }),
    createElement('circle', {
      cx: '8',
      cy: '11.25',
      fill: 'currentColor',
      r: '0.75',
    }),
  ),
  check: symbol(
    createElement('path', {
      d: 'm3.5 8.25 2.75 2.75L12.5 4.75',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  ),
  chevronDown: symbol(
    createElement('path', {
      d: 'm3.75 6.25 4.25 4 4.25-4',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  ),
  chevronVertical: symbol(
    createElement('path', {
      d: 'm3.75 6.5 4.25-4 4.25 4',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'm3.75 9.5 4.25 4 4.25-4',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  ),
  chevronUp: symbol(
    createElement('path', {
      d: 'm3.75 9.75 4.25-4 4.25 4',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  ),
  chevronRight: symbol(
    createElement('path', {
      d: 'm6 4 4 4-4 4',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  ),
  close: symbol(
    createElement('path', {
      d: 'm4.5 4.5 7 7m0-7-7 7',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeWidth: '1.5',
    }),
  ),
  copy: symbol(
    createElement('rect', {
      x: '5.25',
      y: '3.25',
      width: '7.5',
      height: '7.5',
      rx: '1.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'M10.75 12.75h-5.5a2 2 0 0 1-2-2v-5.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  ),
  edit: symbol(
    createElement('path', {
      d: 'm10.75 3.75 1.5 1.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'm4 12 2.5-.5 5.75-5.75a1.06 1.06 0 0 0 0-1.5l-.5-.5a1.06 1.06 0 0 0-1.5 0L4.5 9.5 4 12Z',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  ),
  expand: symbol(
    createElement('path', {
      d: 'M9.25 3.5h3.25v3.25',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'm12.5 3.5-5.5 5.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'M6.75 12.5H3.5V9.25',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'm3.5 12.5 5.5-5.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  ),
  info: symbol(
    createElement('circle', {
      cx: '8',
      cy: '8',
      fill: 'none',
      r: '5.75',
      stroke: 'currentColor',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'M8 7.25v3',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeWidth: '1.5',
    }),
    createElement('circle', {
      cx: '8',
      cy: '5',
      fill: 'currentColor',
      r: '0.75',
    }),
  ),
  menu: symbol(
    createElement('path', {
      d: 'M3 4.75h10M3 8h10M3 11.25h10',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeWidth: '1.5',
    }),
  ),
  open: symbol(
    createElement('path', {
      d: 'M6.25 4H4.5A1.5 1.5 0 0 0 3 5.5v6A1.5 1.5 0 0 0 4.5 13h6A1.5 1.5 0 0 0 12 11.5V9.75',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'M8 3h5v5',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'm13 3-6.25 6.25',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  ),
  search: symbol(
    createElement('circle', {
      cx: '7',
      cy: '7',
      fill: 'none',
      r: '4.25',
      stroke: 'currentColor',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'm10.25 10.25 3 3',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeWidth: '1.5',
    }),
  ),
  spinner: symbol(
    createElement('circle', {
      cx: '8',
      cy: '8',
      fill: 'none',
      opacity: '0.24',
      r: '5.25',
      stroke: 'currentColor',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'M8 2.75a5.25 5.25 0 0 1 5.25 5.25',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeWidth: '1.5',
    }),
  ),
  trash: symbol(
    createElement('path', {
      d: 'M3.75 4.75h8.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'M6.25 4.75V4a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v.75',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'm5 6.25.45 5.1A1.5 1.5 0 0 0 6.94 12.75h2.12a1.5 1.5 0 0 0 1.49-1.4L11 6.25',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'M7 7.25v3.5M9 7.25v3.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeWidth: '1.5',
    }),
  ),
  arrowRight: symbol(
    createElement('path', {
      d: 'M3 8h10',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'm9 4 4 4-4 4',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  ),
  calendar: symbol(
    createElement('rect', {
      x: '2.25',
      y: '3.25',
      width: '11.5',
      height: '11.5',
      rx: '1.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'M2.25 7.25h11.5M5.25 2v2.5M10.75 2v2.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'M5.25 9.75h1.5M9.25 9.75h1.5M5.25 11.75h1.5M9.25 11.75h1.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeWidth: '1.5',
    }),
  ),
  chat: symbol(
    createElement('path', {
      d: 'M3.25 4.25a1.5 1.5 0 0 1 1.5-1.5h6.5a1.5 1.5 0 0 1 1.5 1.5v4.5a1.5 1.5 0 0 1-1.5 1.5H6.75L3.25 13V4.25Z',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  ),
  clock: symbol(
    createElement('circle', {
      cx: '8',
      cy: '8',
      fill: 'none',
      r: '5.75',
      stroke: 'currentColor',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'M8 4.5V8l2.5 1.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  ),
  cog: symbol(
    createElement('path', {
      d: 'M8 2.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5A5.5 5.5 0 0 1 2.5 8 5.5 5.5 0 0 1 8 2.5z',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'M8 5.75a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5z',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '1.5',
    }),
  ),
  eye: symbol(
    createElement('path', {
      d: 'M1.75 8s2.5-5 6.25-5 6.25 5 6.25 5-2.5 5-6.25 5S1.75 8 1.75 8z',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
    createElement('circle', {
      cx: '8',
      cy: '8',
      fill: 'none',
      r: '2',
      stroke: 'currentColor',
      strokeWidth: '1.5',
    }),
  ),
  eyeOff: symbol(
    createElement('path', {
      d: 'M1.75 8s2.5-5 6.25-5 6.25 5 6.25 5-2.5 5-6.25 5S1.75 8 1.75 8z',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
    createElement('circle', {
      cx: '8',
      cy: '8',
      fill: 'none',
      r: '2',
      stroke: 'currentColor',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'm3 13 10-10',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeWidth: '1.5',
    }),
  ),
  moon: symbol(
    createElement('path', {
      d: 'M13.25 10.1A5.75 5.75 0 0 1 5.9 2.75 5.75 5.75 0 1 0 13.25 10.1z',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  ),
  send: symbol(
    createElement('path', {
      d: 'M2.5 7.75 13.5 2.5l-2.5 11-4-4.5-4.5-1.25Z',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'M7 9.5 13.5 2.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeWidth: '1.5',
    }),
  ),
  shield: symbol(
    createElement('path', {
      d: 'M8 1.75 2.5 4v5.5c0 4.25 5.5 6.75 5.5 6.75s5.5-2.5 5.5-6.75V4L8 1.75z',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  ),
  user: symbol(
    createElement('path', {
      d: 'M8 2.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
    createElement('path', {
      d: 'M2.25 14.25v.5a3 3 0 0 0 3 3h5.5a3 3 0 0 0 3-3v-.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  ),
  zap: symbol(
    createElement('path', {
      d: 'M9.5 1.75 4 9.25h4l-1.5 5 6-7.5h-4L9.5 1.75Z',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  ),
}
