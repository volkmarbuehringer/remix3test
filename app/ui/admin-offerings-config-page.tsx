import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import button from '../ui/theme/button.ts'
import { animateEntrance } from 'remix/ui/animation'
import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
import { RestfulForm } from './restful-form.tsx'
import { routes } from '../routes.ts'
import type { OfferingsResourceOption } from '../data/offerings-queries.ts'
import type { OfferingConfig } from '../data/offering-configs.ts'

interface AdminOfferingsConfigPageProps {
  resources: OfferingsResourceOption[]
  config: OfferingConfig | undefined
  resourceId: number
}

const DAYS = [
  { key: 'monday', label: 'Montag' },
  { key: 'tuesday', label: 'Dienstag' },
  { key: 'wednesday', label: 'Mittwoch' },
  { key: 'thursday', label: 'Donnerstag' },
  { key: 'friday', label: 'Freitag' },
  { key: 'saturday', label: 'Samstag' },
  { key: 'sunday', label: 'Sonntag' },
] as const

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => i * 60)
const TIME_END_OPTIONS = Array.from({ length: 24 }, (_, i) => (i + 1) * 60)

function fmt(minutes: number): string {
  let h = String(Math.floor(minutes / 60)).padStart(2, '0')
  let m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
}

// ── Styles (unique to this config panel) ──

const dayRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  padding: `${theme.space.xs} 0`,
})

const timeSelectStyle = css({
  width: '90px',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  fontSize: theme.fontSize.sm,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl0,
  color: theme.colors.text.primary,
  outline: 'none',
  '&:focus': {
    borderColor: theme.colors.action.primary.background,
    boxShadow: `0 0 0 2px ${theme.colors.focus.ring}`,
  },
})

const dayCheckboxStyle = css({
  width: '18px',
  height: '18px',
  cursor: 'pointer',
})

export function AdminOfferingsConfigPage(handle: Handle<AdminOfferingsConfigPageProps>) {
  return () => {
    let { resources, config, resourceId } = handle.props
    let rules: Record<string, [number, number]> = (config?.rules ?? {}) as Record<
      string,
      [number, number]
    >

    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="POST" action={routes.verwaltung.offerings.configSave.href()}>
          <input type="hidden" name="resource_id" value={String(resourceId)} />

          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Konfiguration</span>
            </div>

            <div mix={table.panelBody}>
              <div mix={table.fieldGroup}>
                <label mix={table.label}>Ressource</label>
                <select
                  name="_resource_display"
                  disabled
                  mix={[input.base, input.focus, table.select]}
                >
                  {resources
                    .filter((r) => Number(r.id) === resourceId)
                    .map((r) => (
                      <option key={r.id} value={r.id} selected>
                        {r.name}
                      </option>
                    ))}
                </select>
              </div>

              {DAYS.map((day) => {
                let rule = rules[day.key]
                let hasRule = !!rule
                let startMin = rule ? rule[0] : 480
                let endMin = rule ? rule[1] : 1020
                return (
                  <div key={day.key} mix={dayRowStyle}>
                    <input
                      type="checkbox"
                      id={`cfg-${day.key}`}
                      name={`${day.key}_enabled`}
                      value="1"
                      checked={hasRule}
                      mix={dayCheckboxStyle}
                    />
                    <label
                      for={`cfg-${day.key}`}
                      mix={css({ width: '100px', fontSize: theme.fontSize.sm, cursor: 'pointer' })}
                    >
                      {day.label}
                    </label>
                    <select name={`${day.key}_start`} mix={timeSelectStyle}>
                      {TIME_OPTIONS.map((min) => (
                        <option key={min} value={min} selected={min === startMin}>
                          {fmt(min)}
                        </option>
                      ))}
                    </select>
                    <span
                      mix={css({ fontSize: theme.fontSize.sm, color: theme.colors.text.muted })}
                    >
                      –
                    </span>
                    <select name={`${day.key}_end`} mix={timeSelectStyle}>
                      {TIME_END_OPTIONS.map((min) => (
                        <option key={min} value={min} selected={min === endMin}>
                          {fmt(min)}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}

              <div mix={table.actions}>
                <button type="submit" mix={[button({ tone: 'primary' }), table.spacer]}>
                  Speichern
                </button>
                <a
                  href={routes.verwaltung.offerings.index.href()}
                  mix={[table.spacer, table.linkPlain]}
                >
                  <button
                    type="button"
                    mix={[button({ tone: 'secondary' }), css({ width: '100%' })]}
                  >
                    Abbrechen
                  </button>
                </a>
              </div>
            </div>
          </div>
        </RestfulForm>
      </div>
    )
  }
}
