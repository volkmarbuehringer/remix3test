import { clientEntry, css, on, type Handle } from 'remix/ui'
import { theme } from '../lib/theme.ts'

interface Row {
  id: number
  key: string
  value: string
}

let nextId = 0

function newRow(): Row {
  return { id: nextId++, key: '', value: '' }
}

function csrfToken(): string {
  if (typeof document === 'undefined') return ''
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''
}

export const WebhookComposer = clientEntry(
  import.meta.url + '#WebhookComposer',
  function WebhookComposer(handle: Handle) {
    let rows: Row[] = [newRow()]

    function assembledPayload(): Record<string, string> {
      let obj: Record<string, string> = {}
      for (let r of rows) {
        if (r.key.trim()) {
          obj[r.key] = r.value
        }
      }
      return obj
    }

    function addRow() {
      rows = [...rows, newRow()]
      handle.update()
    }

    function removeRow(id: number) {
      rows = rows.filter((r) => r.id !== id)
      if (rows.length === 0) rows = [newRow()]
      handle.update()
    }

    function updateKey(id: number, key: string) {
      rows = rows.map((r) => (r.id === id ? { ...r, key } : r))
      handle.update()
    }

    function updateValue(id: number, value: string) {
      rows = rows.map((r) => (r.id === id ? { ...r, value } : r))
      handle.update()
    }

    return () => {
      let json = assembledPayload()
      let jsonStr = JSON.stringify(json, null, 2)

      return (
        <div mix={pageStyle}>
          <form method="POST" action="/webhook-requests/create" mix={formStyle}>
            <input type="hidden" name="payload" value={jsonStr} />
            <input type="hidden" name="_csrf" value={csrfToken()} />

            <div mix={gridWrap}>
              <table mix={gridTable}>
                <thead>
                  <tr>
                    <th mix={thKey}>Key</th>
                    <th mix={thValue}>Value</th>
                    <th mix={thAction}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td mix={tdKey}>
                        <input
                          type="text"
                          value={row.key}
                          placeholder="key"
                          mix={[
                            inputStyle,
                            on('input', (e) => updateKey(row.id, (e.target as HTMLInputElement).value)),
                          ]}
                        />
                      </td>
                      <td mix={tdValue}>
                        <input
                          type="text"
                          value={row.value}
                          placeholder="value"
                          mix={[
                            inputStyle,
                            on('input', (e) => updateValue(row.id, (e.target as HTMLInputElement).value)),
                          ]}
                        />
                      </td>
                      <td mix={tdAction}>
                        <button
                          type="button"
                          mix={[removeBtnStyle, on('click', () => removeRow(row.id))]}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button type="button" mix={[addBtnStyle, on('click', addRow)]}>
              + Add Row
            </button>

            <div mix={previewSection}>
              <span mix={previewLabel}>Preview</span>
              <pre mix={previewStyle}>{jsonStr}</pre>
            </div>

            <div mix={actionsStyle}>
              <a href="/webhook-requests" mix={cancelLinkStyle}>Abbrechen</a>
              <button type="submit" mix={submitBtnStyle}>In Tabelle speichern</button>
            </div>
          </form>
        </div>
      )
    }
  },
)

const pageStyle = css({
  maxWidth: '700px',
})

const formStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
})

const gridWrap = css({
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  overflow: 'hidden',
})

const gridTable = css({
  width: '100%',
  borderCollapse: 'collapse',
})

const thKey = css({
  textAlign: 'left',
  padding: `${theme.space.sm} ${theme.space.md}`,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  background: theme.surface.lvl2,
  borderBottom: `1px solid ${theme.colors.border.default}`,
  width: '35%',
})

const thValue = css({
  textAlign: 'left',
  padding: `${theme.space.sm} ${theme.space.md}`,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  background: theme.surface.lvl2,
  borderBottom: `1px solid ${theme.colors.border.default}`,
})

const thAction = css({
  width: '40px',
  background: theme.surface.lvl2,
  borderBottom: `1px solid ${theme.colors.border.default}`,
})

const tdKey = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
})

const tdValue = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
})

const tdAction = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  textAlign: 'center',
})

const inputStyle = css({
  width: '100%',
  padding: `${theme.space.sm} ${theme.space.md}`,
  border: `1px solid ${theme.colors.border.strong}`,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.md,
  outline: 'none',
  fontFamily: theme.fontFamily.sans,
  boxSizing: 'border-box',
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
  '&:focus': {
    borderColor: theme.colors.focus.ring,
    boxShadow: `0 0 0 3px ${theme.colors.focus.ring}33`,
  },
  '&::placeholder': {
    color: theme.colors.text.muted,
  },
})

const removeBtnStyle = css({
  width: '28px',
  height: '28px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: theme.radius.md,
  backgroundColor: 'transparent',
  color: theme.colors.text.muted,
  cursor: 'pointer',
  fontSize: theme.fontSize.sm,
  '&:hover': {
    backgroundColor: theme.colors.action.danger.background,
    color: theme.colors.action.danger.foreground,
  },
})

const addBtnStyle = css({
  alignSelf: 'flex-start',
  padding: `${theme.space.sm} ${theme.space.md}`,
  border: `1px dashed ${theme.colors.border.strong}`,
  borderRadius: theme.radius.md,
  backgroundColor: 'transparent',
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  cursor: 'pointer',
  '&:hover': {
    borderColor: theme.colors.action.primary.background,
    color: theme.colors.action.primary.background,
  },
})

const previewSection = css({
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  padding: theme.space.md,
  background: theme.surface.lvl1,
})

const previewLabel = css({
  display: 'block',
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: theme.space.sm,
})

const previewStyle = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  fontFamily: 'monospace',
  color: theme.colors.text.primary,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
})

const actionsStyle = css({
  display: 'flex',
  gap: theme.space.md,
  justifyContent: 'flex-end',
  alignItems: 'center',
})

const cancelLinkStyle = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  textDecoration: 'none',
  '&:hover': {
    color: theme.colors.text.primary,
    textDecoration: 'underline',
  },
})

const submitBtnStyle = css({
  padding: `${theme.space.sm} ${theme.space.lg}`,
  backgroundColor: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none',
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: theme.colors.action.primary.backgroundHover,
  },
})
