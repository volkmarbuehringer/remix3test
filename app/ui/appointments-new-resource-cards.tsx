import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'

import type { ResourceOption } from '../data/appointments.ts'
import type { GridState } from '../utils/grid-state.ts'
import { routes } from '../routes.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'
import { input } from './mixins/input.ts'
import { ResourceSearchLive } from './appointments-new-resource-search.browser.tsx'

const rootStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

const cardList = css({
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

const searchRowStyle = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
})

const searchIconStyle = css({
  position: 'absolute',
  left: theme.space.sm,
  display: 'inline-flex',
  color: theme.colors.text.muted,
  pointerEvents: 'none',
})

const searchPadding = css({
  paddingLeft: '2rem',
})

const searchMetaRow = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: theme.space.sm,
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.muted,
})

const countStyle = css({
  flexShrink: 0,
})

const noMatchStyle = css({
  paddingTop: theme.space.md,
  paddingBottom: theme.space.md,
  paddingLeft: theme.space.sm,
  paddingRight: theme.space.sm,
  textAlign: 'center',
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: theme.colors.border.default,
  borderRadius: theme.radius.md,
})

const cardLink = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minHeight: '48px',
  paddingTop: theme.space.sm,
  paddingBottom: theme.space.sm,
  paddingLeft: theme.space.md,
  paddingRight: theme.space.md,
  background: theme.surface.lvl1,
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: theme.colors.border.default,
  borderRadius: theme.radius.lg,
  color: theme.colors.text.primary,
  textDecoration: 'none',
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.medium,
  transition: 'border-color 150ms ease, box-shadow 150ms ease',
  '&:hover': {
    borderColor: theme.colors.action.primary.background,
    boxShadow: '0 0 0 2px ' + theme.colors.focus.ring,
  },
})

const cardName = css({
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.medium,
})

const cardDescription = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
})

interface ResourceCardsProps {
  resources: ResourceOption[]
  gridState: GridState
}

function buildResourceUrl(resourceId: string | number, gridState: GridState): string {
  let params = new URLSearchParams()
  params.set('creating', 'true')
  params.set('step', '2')
  params.set('resource_id', String(resourceId))
  if (gridState.period) params.set('period', gridState.period)
  if (gridState.status) params.set('status', gridState.status)
  if (gridState.offset) params.set('offset', gridState.offset)
  if (gridState.sort) params.set('sort', gridState.sort)
  if (gridState.order) params.set('order', gridState.order)
  if (gridState.filter) params.set('filter', gridState.filter)
  let qs = params.toString()
  return routes.appointmentsNew.index.href() + (qs ? '?' + qs : '')
}

export function ResourceCards(handle: Handle<ResourceCardsProps>) {
  return () => {
    let { resources, gridState } = handle.props

    if (resources.length === 0) {
      return (
        <div
          mix={css({
            textAlign: 'center',
            padding: theme.space.xl,
            color: theme.colors.text.muted,
            fontSize: theme.fontSize.sm,
          })}
        >
          Keine Ressourcen verfügbar.
        </div>
      )
    }

    return (
      <div data-resource-search-root="" mix={rootStyle}>
        <ResourceSearchLive />
        <div mix={searchRowStyle}>
          <span mix={searchIconStyle} aria-hidden="true">
            <Glyph name="search" width={15} height={15} />
          </span>
          <input
            type="search"
            data-resource-search=""
            mix={[input.base, input.focus, searchPadding]}
            placeholder="Ressource suchen..."
            aria-label="Ressourcen durchsuchen"
            autoComplete="off"
          />
        </div>
        <div mix={searchMetaRow}>
          <span data-resource-search-count="" mix={countStyle} aria-live="polite">
            {resources.length} {resources.length === 1 ? 'Ressource' : 'Ressourcen'}
          </span>
        </div>
        <ul data-resource-list="" mix={cardList}>
          {resources.map((res) => {
            let searchText = [res.name, res.description].filter(Boolean).join(' ')
            return (
              <li key={res.id} data-resource-card="" data-search-text={searchText}>
                <a href={buildResourceUrl(res.id, gridState)} mix={cardLink}>
                  <span mix={cardName}>{res.name}</span>
                  {res.description ? <span mix={cardDescription}>{res.description}</span> : null}
                </a>
              </li>
            )
          })}
        </ul>
        <div data-resource-search-empty="" mix={noMatchStyle} style={{ display: 'none' }}>
          Keine Ressource gefunden. Bitte passen Sie den Suchbegriff an.
        </div>
      </div>
    )
  }
}
