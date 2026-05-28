import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { animateEntrance } from 'remix/ui/animation'
import { input } from './mixins/input.ts'
import { RestfulForm } from './restful-form.tsx'
import type { ResourceOption } from '../actions/admin-offerings-controller.tsx'
import type { OfferingConfig } from '../data/offering-configs.ts'

interface AdminOfferingsConfigPageProps {
  resources: ResourceOption[]
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

// ── Styles ──

const panelStyle = css({
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  overflow: 'hidden',
})

const panelHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  padding: `${theme.space.md} ${theme.space.lg}`,
  borderBottom: `1px solid ${theme.colors.border.default}`,
  background: theme.surface.lvl2,
})

const panelTitleStyle = css({
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const panelBodyStyle = css({
  padding: theme.space.lg,
})

const fieldGroupStyle = css({
  marginBottom: theme.space.md,
})

const dayRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  padding: `${theme.space.xs} 0`,
})

const labelStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
  marginBottom: theme.space.xs,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
})

const selectStyle = css({
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

const actionsStyle = css({
  display: 'flex',
  gap: theme.space.sm,
  marginTop: theme.space.lg,
  paddingTop: theme.space.md,
  borderTop: `1px solid ${theme.colors.border.default}`,
})

export function AdminOfferingsConfigPage(handle: Handle<AdminOfferingsConfigPageProps>) {
  return () => {
    let { resources, config, resourceId } = handle.props
    let rules: Record<string, [number, number]> = (config?.rules ?? {}) as Record<string, [number, number]>

    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="POST" action="/admin/offerings/config">
          <input type="hidden" name="resource_id" value={String(resourceId)} />

          <div mix={panelStyle}>
            <div mix={panelHeaderStyle}>
              <span mix={panelTitleStyle}>Konfiguration</span>
            </div>

            <div mix={panelBodyStyle}>
              <div mix={fieldGroupStyle}>
                <label mix={labelStyle}>Ressource</label>
                <select name="_resource_display" disabled mix={[input.base, input.focus, selectStyle]}>
                  {resources.filter(r => Number(r.id) === resourceId).map(r => (
                    <option key={r.id} value={r.id} selected>{r.description}</option>
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
                    <label for={`cfg-${day.key}`} mix={css({ width: '100px', fontSize: theme.fontSize.sm, cursor: 'pointer' })}>
                      {day.label}
                    </label>
                    <select name={`${day.key}_start`} mix={timeSelectStyle}>
                      {TIME_OPTIONS.map((min) => (
                        <option key={min} value={min} selected={min === startMin}>
                          {fmt(min)}
                        </option>
                      ))}
                    </select>
                    <span mix={css({ fontSize: theme.fontSize.sm, color: theme.colors.text.muted })}>–</span>
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

              <div mix={actionsStyle}>
                <Button type="submit" tone="primary" mix={css({ flex: 1 })}>
                  Speichern
                </Button>
                <a href="/admin/offerings" style={{ flex: 1, textDecoration: 'none' }}>
                  <Button type="button" tone="secondary" mix={css({ width: '100%' })}>
                    Abbrechen
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </RestfulForm>
      </div>
    )
  }
}
