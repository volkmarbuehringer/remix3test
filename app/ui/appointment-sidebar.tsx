import { css, type Handle } from 'remix/component'
import { rotatedGlyphCss } from './mixins/icon.ts'
import { theme } from '../ui/theme/theme.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'

import { formatDateRange } from '../utils/appointment.ts'
import { frames, routes } from '../routes.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'

const YEARS = [2026, 2027, 2028, 2029, 2030] as const
const WEEKS = Array.from({ length: 52 }, (_, i) => i + 1)

function prevWeek(year: number, week: number): { year: number; week: number } {
  if (week > 1) return { year, week: week - 1 }
  return { year: year - 1, week: 52 }
}

function nextWeek(year: number, week: number): { year: number; week: number } {
  if (week < 52) return { year, week: week + 1 }
  return { year: year + 1, week: 1 }
}

interface AppointmentSidebarProps {
  year: number
  week: number
  weekStart: number
  selectedResourceId: number
  resources: Array<{ id: number; name: string }>
}

/**
 * Server-rendered appointment navigation.
 *
 * The year/week/resource controls are a plain GET form plus prev/next links,
 * all targeting the `appointmentContent` frame. The server already knows the
 * current year/week, so it can compute both prev/next hrefs; the browser
 * serializes the selects into the destination URL. No clientEntry is needed.
 *
 * `data-rmx-key` makes the frame's server-HTML diff replace the controls
 * whenever the view changes. Without it the reconciler preserves the live
 * `<option selected>` state (its generic live-input policy), so clicking
 * prev/next would update the grid while the year select kept its old value.
 */
export function AppointmentSidebar(handle: Handle<AppointmentSidebarProps>) {
  return () => {
    let { year, week, weekStart, selectedResourceId, resources } = handle.props
    let weekDateRange = weekStart ? formatDateRange(weekStart) : ''
    let previous = prevWeek(year, week)
    let next = nextWeek(year, week)
    let weekHref = (y: number, w: number) =>
      `${routes.appointment.index.href()}?year=${y}&week=${w}&resource_id=${selectedResourceId}`

    return (
      <aside aria-label="Terminnavigation" data-appointment-sidebar="true" mix={sidebarStyle}>
        <div mix={sidebarHeaderStyle}>
          <span mix={appTitleStyle}>Termine</span>
        </div>

        <div mix={pickerGroupStyle}>
          <form
            action={routes.appointment.index.href()}
            method="get"
            data-rmx-target={frames.appointmentContent}
            data-rmx-key={`${year}-${week}-${selectedResourceId}`}
            mix={pickerFormStyle}
          >
            <div mix={pickerRowStyle}>
              <select name="resource_id" aria-label="Ressource auswählen" mix={selectResourceStyle}>
                {resources.map((res) => (
                  <option key={res.id} value={res.id} selected={res.id === selectedResourceId}>
                    {res.name}
                  </option>
                ))}
              </select>
            </div>

            <div mix={pickerRowStyle}>
              <select name="year" aria-label="Jahr auswählen" mix={selectYearStyle}>
                {YEARS.map((y) => (
                  <option key={y} value={y} selected={y === year}>
                    {y}
                  </option>
                ))}
              </select>

              <select name="week" aria-label="Woche auswählen" mix={selectStyle}>
                {WEEKS.map((w) => (
                  <option key={w} value={w} selected={w === week}>
                    KW {w}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" mix={pickerSubmitStyle}>
              Anzeigen
            </button>
          </form>

          <div mix={dateRangeRowStyle}>
            <a
              href={weekHref(previous.year, previous.week)}
              data-rmx-target={frames.appointmentContent}
              aria-label="Vorherige Woche"
              mix={navArrowStyle}
            >
              <Glyph name="chevronRight" width={16} height={16} mix={rotatedGlyphCss} />
            </a>
            <span mix={dateRangeStyle}>{weekDateRange}</span>
            <a
              href={weekHref(next.year, next.week)}
              data-rmx-target={frames.appointmentContent}
              aria-label="Nächste Woche"
              mix={navArrowStyle}
            >
              <Glyph name="chevronRight" width={16} height={16} />
            </a>
          </div>
        </div>

        <nav aria-label="Navigation" mix={navStyle}>
          <a href={routes.home.href()} mix={navLinkStyle}>
            Startseite
          </a>
          <a href={routes.lists.index.href()} mix={navLinkStyle}>
            Listen
          </a>
          <form action={routes.auth.logout.href()} method="post" mix={logoutFormStyle}>
            <CsrfTokenInput />
            <button type="submit" mix={logoutButtonStyle}>
              Abmelden
            </button>
          </form>
        </nav>
      </aside>
    )
  }
}

const sidebarStyle = css({
  backgroundColor: theme.surface.lvl0,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.xl,
  display: 'grid',
  gridTemplateRows: '56px auto 1fr',
  minHeight: 0,
  overflow: 'hidden',
  width: '280px',
})

const sidebarHeaderStyle = css({
  alignItems: 'center',
  display: 'flex',
  padding: `${theme.space.sm} ${theme.space.md}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
})

const appTitleStyle = css({
  color: theme.colors.action.primary.background,
  fontSize: theme.fontSize.xl,
  fontWeight: theme.fontWeight.bold,
  letterSpacing: theme.letterSpacing.tight,
})

const pickerGroupStyle = css({
  padding: `${theme.space.none} ${theme.space.md} ${theme.space.md}`,
  display: 'grid',
  gap: theme.space.xs,
})

const pickerFormStyle = css({
  display: 'grid',
  gap: theme.space.xs,
})

const pickerRowStyle = css({
  display: 'flex',
  gap: theme.space.sm,
})

const selectStyle = css({
  backgroundColor: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  color: theme.colors.text.primary,
  flex: 1,
  font: 'inherit',
  fontSize: theme.fontSize.sm,
  minHeight: theme.control.height.sm,
  padding: `0 ${theme.space.sm}`,
  '&:focus': {
    borderColor: theme.colors.focus.ring,
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '2px',
  },
})

const selectResourceStyle = css({
  backgroundColor: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  color: theme.colors.text.primary,
  font: 'inherit',
  fontSize: theme.fontSize.sm,
  minHeight: theme.control.height.sm,
  minWidth: 0,
  padding: `0 ${theme.space.sm}`,
  width: '100%',
  '&:focus': {
    borderColor: theme.colors.focus.ring,
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '2px',
  },
})

const selectYearStyle = css({
  backgroundColor: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  color: theme.colors.text.primary,
  flex: 0.18,
  font: 'inherit',
  fontSize: theme.fontSize.sm,
  minHeight: theme.control.height.sm,
  padding: `0 ${theme.space.sm}`,
  '&:focus': {
    borderColor: theme.colors.focus.ring,
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '2px',
  },
})

const pickerSubmitStyle = css({
  backgroundColor: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  color: theme.colors.text.primary,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: theme.fontSize.sm,
  minHeight: theme.control.height.sm,
  padding: `0 ${theme.space.sm}`,
  '&:hover': {
    backgroundColor: theme.surface.lvl2,
  },
})

const dateRangeRowStyle = css({
  alignItems: 'center',
  display: 'flex',
  gap: theme.space.xs,
})

const navArrowStyle = css({
  alignItems: 'center',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  color: theme.colors.text.secondary,
  display: 'inline-flex',
  justifyContent: 'center',
  fontSize: theme.fontSize.md,
  lineHeight: 1,
  height: '28px',
  width: '28px',
  padding: 0,
  textDecoration: 'none',
  '&:hover': {
    backgroundColor: theme.surface.lvl2,
    color: theme.colors.text.primary,
  },
})

const dateRangeStyle = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  textAlign: 'left',
  userSelect: 'none',
})

const navStyle = css({
  display: 'grid',
  gap: theme.space.xs,
  padding: `${theme.space.lg} ${theme.space.md}`,
  borderTop: `1px solid ${theme.colors.border.subtle}`,
})

const navLinkStyle = css({
  borderRadius: theme.radius.md,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  padding: `${theme.space.xs} ${theme.space.sm}`,
  textDecoration: 'none',
  '&:hover': {
    backgroundColor: theme.surface.lvl2,
    color: theme.colors.text.primary,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '2px',
  },
})

const logoutFormStyle = css({
  margin: 0,
})

const logoutButtonStyle = css({
  background: 'none',
  border: 0,
  borderRadius: theme.radius.md,
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: theme.fontSize.sm,
  padding: `${theme.space.xs} ${theme.space.sm}`,
  textAlign: 'left',
  width: '100%',
  '&:hover': {
    backgroundColor: theme.surface.lvl2,
    color: theme.colors.text.primary,
  },
})
