## 1. Create local theme module at `app/lib/theme/`

### 1.1 Copy and adapt contract.ts

- [x] Create `app/lib/theme/contract.ts` from `packages/ui/src/theme/contract.ts`
  - Replace `import type { css, Handle, MixinDescriptor, RemixElement } from '@remix-run/ui'` → `import type { css, Handle, MixinDescriptor, RemixElement } from 'remix/ui'`
  - Keep all type definitions and the `theme` contract object identical

### 1.2 Create layers.ts

- [x] Create `app/lib/theme/layers.ts` with:
  ```ts
  export const REMIX_UI_STYLE_LAYER = 'rmx'
  export const REMIX_UI_RESET_LAYER = 'rmx-reset'
  ```

### 1.3 Copy and adapt runtime.ts

- [x] Create `app/lib/theme/runtime.ts` from `packages/ui/src/theme/runtime.ts`
  - Replace `import { createElement, type Handle } from '@remix-run/ui'` → `import { createElement, type Handle } from 'remix/ui'`
  - Replace `import { REMIX_UI_RESET_LAYER, REMIX_UI_STYLE_LAYER } from '../style/layers.ts'` → `import { REMIX_UI_RESET_LAYER, REMIX_UI_STYLE_LAYER } from './layers.ts'`
  - Keep all other code identical

### 1.4 Copy glyph-contract.ts

- [x] Create `app/lib/theme/glyph-contract.ts` from `packages/ui/src/theme/glyph-contract.ts`
  - Replace `import type { RemixElement } from '@remix-run/ui'` → `import type { RemixElement } from 'remix/ui'`
  - Keep all names, IDs, and types identical

### 1.5 Create presets directory and glyphs

- [x] Create `app/lib/theme/presets/rmx-01/glyphs.tsx` from `packages/ui/src/theme/presets/rmx-01/glyphs.tsx`
  - Replace `import { createElement } from '@remix-run/ui'` → `import { createElement } from 'remix/ui'`
  - Replace `import type { RemixNode } from '@remix-run/ui'` → `import type { RemixNode } from 'remix/ui'`
  - Keep all glyph path definitions identical

### 1.6 Create presets index

- [x] Create `app/lib/theme/presets/rmx-01/index.ts` from `packages/ui/src/theme/presets/rmx-01/index.ts`
  - Copy `createGlyphSheet` import path: update to `from '../../../glyph/glyph.tsx'`
  - Keep the `RMX_01` theme values and `RMX_01_GLYPHS` export identical

### 1.7 Create barrel at `app/lib/theme.ts`

- [x] Create `app/lib/theme.ts` that re-exports from the theme module

## 2. Create local glyph module at `app/lib/glyph/`

### 2.1 Copy and adapt glyph.tsx

- [x] Create `app/lib/glyph/glyph.tsx` from `packages/ui/src/components/glyph/glyph.tsx`
  - Replace `@remix-run/ui` → `remix/ui` imports
  - Replace relative glyph-contract path to `../theme/glyph-contract.ts`
  - Keep `Glyph`, `createGlyphSheet`, and all types identical

### 2.2 Create barrel at `app/lib/glyph.ts`

- [x] Create `app/lib/glyph.ts` that re-exports from `./glyph/glyph.tsx`

## 3. Create local separator module at `app/lib/separator/`

### 3.1 Copy and adapt separator.ts

- [x] Create `app/lib/separator/separator.ts` from installed dist (includes both `separatorStyle` mixin and `Separator` component)

### 3.2 Create barrel at `app/lib/separator.ts`

- [x] Create `app/lib/separator.ts` that re-exports `Separator` and `separatorStyle`

## 4. Extended glyph names and paths

- [x] Add extended glyph names to `app/lib/theme/glyph-contract.ts` (arrowRight, calendar, chat, clock, cog, eye, eyeOff, moon, send, shield, user, zap)
- [x] Add SVG path definitions for each new glyph in `app/lib/theme/presets/rmx-01/glyphs.tsx`

## 5. Update `app/theme.tsx`

- [x] Change `import { createTheme } from 'remix/ui/theme'` → `import { createTheme } from './lib/theme.ts'`

## 6. Update `app/ui/document.tsx`

- [x] Merge two imports from `remix/ui/theme` into one: `import { theme as themeTokens, RMX_01_GLYPHS } from '../lib/theme.ts'`

## 7. Update all `remix/ui/theme` imports throughout app

- [x] Update imports in `app/actions/` directory
- [x] Update imports in `app/assets/` directory
- [x] Update imports in `app/ui/mixins/` and `app/ui/admin-fragments/` and `app/ui/ai-fragments/`
- [x] Update imports in `app/ui/` main page files

## 8. Update all `remix/ui/glyph` imports throughout app

- [x] Update imports in `app/assets/`, `app/actions/`, `app/ui/`

## 9. Update all `remix/ui/separator` imports throughout app

- [x] Update imports in `app/assets/` and `app/ui/`

## 10. Verify

- [x] Run `npm run typecheck` — clean, no type errors
- [x] Run `npm test` — 788 pass, 0 fail (same as baseline)
- [ ] Run `npm run dev` and visually confirm:
  - Pages render with correct theme colors (light + dark toggle)
  - Glyph icons render correctly (all pages using `<Glyph>`)
  - Separators render in context menus
  - No console errors related to missing module imports
- [x] Verify no remaining imports from `remix/ui/theme`, `remix/ui/glyph`, or `remix/ui/separator`:
  ```bash
  grep -rn "from 'remix/ui/theme'\|from 'remix/ui/glyph'\|from 'remix/ui/separator'" app/
  ```
  Should return no results
