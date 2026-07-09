import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'

import type { ResourceOption } from '../data/appointments.ts'
import type { GridState } from '../utils/grid-state.ts'
import { routes } from '../routes.ts'

const cardList = css({
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

const cardLink = css({
  display: 'flex',
  alignItems: 'center',
  minHeight: '48px',
  padding: `${theme.space.sm} ${theme.space.md}`,
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  color: theme.colors.text.primary,
  textDecoration: 'none',
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.medium,
  transition: 'border-color 150ms ease, box-shadow 150ms ease',
  '&:hover': {
    borderColor: theme.colors.action.primary.background,
    boxShadow: `0 0 0 2px ${theme.colors.focus.ring}`,
  },
})

interface ResourceCardsProps {
  resources: ResourceOption[]
  gridState: GridState
}

function buildResourceUrl(resourceId: string, gridState: GridState): string {
  let params = new URLSearchParams()
  params.set('creating', 'true')
  params.set('step', '2')
  params.set('resource_id', resourceId)
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
        <div mix={css({
          textAlign: 'center',
          padding: theme.space.xl,
          color: theme.colors.text.muted,
          fontSize: theme.fontSize.sm,
        })}>
          Keine Ressourcen verfügbar.
        </div>
      )
    }

    return (
      <ul mix={cardList}>
        {resources.map((res) => (
          <li key={res.id}>
            <a href={buildResourceUrl(res.id, gridState)} mix={cardLink}>
              {res.name}
            </a>
          </li>
        ))}
      </ul>
    )
  }
}
