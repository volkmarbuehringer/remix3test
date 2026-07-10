import { clientEntry, css, navigate, on, type Handle } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'

import { formatDateRange, readAppointmentData } from '../utils/appointment.ts'
import { routes } from '../routes.ts'

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

function readData(): {
  year: number
  week: number
  weekStart: number
  selectedResourceId: number
  resources: Array<{ id: number; name: string }>
} {
  let data = readAppointmentData()
  return {
    year: (data.year as number) ?? 2026,
    week: (data.week as number) ?? 1,
    weekStart: (data.weekStart as number) ?? 0,
    selectedResourceId: (data.selectedResourceId as number) ?? 0,
    resources: (data.resources ?? []) as Array<{ id: number; name: string }>,
  }
}

function navigateWithParams(
  baseYear: string | number,
  baseWeek: string | number,
  resourceId: number,
): string {
  return `${routes.appointment.index.href()}?year=${baseYear}&week=${baseWeek}&resource_id=${resourceId}`
}

interface ResourceOption {
  id: number
  name: string
}

export const AppointmentSidebar = clientEntry(
  import.meta.url + '#AppointmentSidebar',
  function AppointmentSidebar(handle: Handle) {
    return () => {
      let { year, week, weekStart, selectedResourceId, resources } = readData()
      let weekDateRange = weekStart ? formatDateRange(weekStart) : ''
      let resourceOptions = resources as ResourceOption[]

      return (
        <aside aria-label="Terminnavigation" data-appointment-sidebar="true" mix={sidebarStyle}>
          <div mix={sidebarHeaderStyle}>
            <span mix={appTitleStyle}>Termine</span>
          </div>

          <div mix={pickerGroupStyle}>
            <div mix={pickerRowStyle}>
              <select
                aria-label="Ressource auswählen"
                value={selectedResourceId}
                id="appt-resource"
                mix={[
                  selectResourceStyle,
                  on('change', () => {
                    let y = document.getElementById('appt-year') as HTMLSelectElement | null
                    let w = document.getElementById('appt-week') as HTMLSelectElement | null
                    let r = document.getElementById('appt-resource') as HTMLSelectElement | null
                    if (y && w && r) {
                      navigate(navigateWithParams(y.value, w.value, parseInt(r.value, 10)))
                    }
                  }),
                ]}
              >
                {resourceOptions.map((res) => (
                  <option key={res.id} value={res.id} selected={res.id === selectedResourceId}>
                    {res.name}
                  </option>
                ))}
              </select>
            </div>

            <div mix={pickerRowStyle}>
              <select
                aria-label="Jahr auswählen"
                value={year}
                id="appt-year"
                mix={[
                  selectYearStyle,
                  on('change', () => {
                    let y = document.getElementById('appt-year') as HTMLSelectElement | null
                    let w = document.getElementById('appt-week') as HTMLSelectElement | null
                    let r = document.getElementById('appt-resource') as HTMLSelectElement | null
                    if (y && w && r) {
                      navigate(navigateWithParams(y.value, w.value, parseInt(r.value, 10)))
                    }
                  }),
                ]}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y} selected={y === year}>
                    {y}
                  </option>
                ))}
              </select>

              <select
                aria-label="Woche auswählen"
                value={week}
                id="appt-week"
                mix={[
                  selectStyle,
                  on('change', () => {
                    let y = document.getElementById('appt-year') as HTMLSelectElement | null
                    let w = document.getElementById('appt-week') as HTMLSelectElement | null
                    let r = document.getElementById('appt-resource') as HTMLSelectElement | null
                    if (y && w && r) {
                      navigate(navigateWithParams(y.value, w.value, parseInt(r.value, 10)))
                    }
                  }),
                ]}
              >
                {WEEKS.map((w) => (
                  <option key={w} value={w} selected={w === week}>
                    KW {w}
                  </option>
                ))}
              </select>
            </div>

            <div mix={dateRangeRowStyle}>
              <button
                aria-label="Vorherige Woche"
                mix={[
                  navArrowStyle,
                  on('click', () => {
                    let p = prevWeek(year, week)
                    navigate(navigateWithParams(p.year, p.week, selectedResourceId))
                  }),
                ]}
              >
                <Glyph
                  name="chevronRight"
                  width={16}
                  height={16}
                  style={{ transform: 'rotate(180deg)' }}
                />
              </button>
              <span mix={dateRangeStyle}>{weekDateRange}</span>
              <button
                aria-label="Nächste Woche"
                mix={[
                  navArrowStyle,
                  on('click', () => {
                    let n = nextWeek(year, week)
                    navigate(navigateWithParams(n.year, n.week, selectedResourceId))
                  }),
                ]}
              >
                <Glyph name="chevronRight" width={16} height={16} />
              </button>
            </div>
          </div>

          <nav aria-label="Navigation" mix={navStyle}>
            <a href={routes.home.href()} mix={navLinkStyle}>
              Startseite
            </a>
            <a href={routes.lists.index.href()} mix={navLinkStyle}>
              Listen
            </a>
            <form
              action={routes.auth.logout.href()}
              method="post"
              mix={logoutFormStyle}
              id="appt-logout-form"
            >
              <button
                type="submit"
                mix={[
                  logoutButtonStyle,
                  on('click', () => {
                    let form = document.getElementById('appt-logout-form') as HTMLFormElement | null
                    if (form && !form.querySelector('input[name="_csrf"]')) {
                      let token = document
                        .querySelector('meta[name="csrf-token"]')
                        ?.getAttribute('content')
                      if (token) {
                        let input = document.createElement('input')
                        input.type = 'hidden'
                        input.name = '_csrf'
                        input.value = token
                        form.appendChild(input)
                      }
                    }
                  }),
                ]}
              >
                Abmelden
              </button>
            </form>
          </nav>
        </aside>
      )
    }
  },
)

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

const dateRangeRowStyle = css({
  alignItems: 'center',
  display: 'flex',
  gap: theme.space.xs,
})

const navArrowStyle = css({
  background: 'none',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  fontSize: theme.fontSize.md,
  lineHeight: 1,
  height: '28px',
  width: '28px',
  padding: 0,
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
