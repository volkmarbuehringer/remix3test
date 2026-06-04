import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { routes } from '../routes.ts'
import type { WorkflowRun } from '../workflows/engine.ts'

export interface WorkflowRunPageProps {
  run?: WorkflowRun
  error?: string
}

const pageTitleStyle = css({
  fontSize: '1.75rem', fontWeight: 600, margin: 0, color: theme.colors.text.primary,
})

const runHeaderStyle = css({
  display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem',
})

const statusBadgeBaseStyle = css({
  display: 'inline-block', padding: '0.375rem 0.75rem', borderRadius: theme.radius.full,
  fontSize: '0.875rem', fontWeight: 500, textTransform: 'capitalize',
})

const statusPendingStyle = css({ background: theme.surface.lvl3, color: theme.colors.text.secondary })
const statusRunningStyle = css({ background: theme.colors.action.primary.background, color: theme.colors.action.primary.foreground })
const statusCompletedStyle = css({ background: (theme.surface as Record<string, string>).successBg, color: (theme.surface as Record<string, string>).successText })
const statusFailedStyle = css({
  background: (theme.surface as Record<string, string>).dangerBg,
  color: (theme.surface as Record<string, string>).dangerText,
})

const infoGridStyle = css({
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: '1rem', marginBottom: '2rem', padding: '1rem',
  background: theme.surface.lvl1, borderRadius: theme.radius.md,
})

const infoItemStyle = css({ display: 'flex', flexDirection: 'column', gap: '0.25rem' })
const infoLabelStyle = css({ fontSize: '0.75rem', fontWeight: 600, color: theme.colors.text.muted, textTransform: 'uppercase' })
const infoValueStyle = css({ fontSize: '0.9375rem', fontWeight: 500, color: theme.colors.text.primary })
const sectionStyle = css({ marginBottom: '2rem' })
const sectionTitleStyle = css({ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: theme.colors.text.primary })

const codeBlockStyle = css({
  background: theme.surface.lvl4, color: theme.colors.text.primary, padding: '1rem', borderRadius: theme.radius.md,
  overflowX: 'auto', fontSize: '0.875rem', lineHeight: 1.5,
})

const stepsListStyle = css({ display: 'flex', flexDirection: 'column', gap: '0.75rem' })
const stepCardStyle = css({
  border: `1px solid ${theme.colors.border.default}`, borderRadius: theme.radius.md,
  padding: '1rem', background: theme.surface.lvl0,
})

const stepHeaderStyle = css({ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' })
const stepNumberStyle = css({
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px',
  borderRadius: '50%', background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground, fontSize: '0.75rem', fontWeight: 600,
})

const stepNameStyle = css({ fontWeight: 600, flex: 1, color: theme.colors.text.primary })
const stepStatusStyle = css({
  fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: theme.radius.full, fontWeight: 500,
})

const stepOutputStyle = css({ marginTop: '0.75rem' })
const stepErrorStyle = css({
  marginTop: '0.75rem', padding: '0.75rem',
  background: (theme.surface as Record<string, string>).dangerBg,
  color: (theme.surface as Record<string, string>).dangerText,
  borderRadius: theme.radius.sm, fontSize: '0.875rem',
})

const errorCardStyle = css({ padding: '2rem', textAlign: 'center' })
const errorTitleStyle = css({ fontSize: '1.5rem', fontWeight: 600, color: theme.colors.action.danger.background, marginBottom: '1rem' })
const errorMessageStyle = css({ color: theme.colors.text.secondary, marginBottom: '1.5rem' })
const actionsStyle = css({ marginTop: '2rem', paddingTop: '1rem', borderTop: `1px solid ${theme.colors.border.default}` })
const backLinkStyle = css({
  color: theme.colors.action.primary.background, textDecoration: 'none', fontWeight: 500,
  '&:hover': { textDecoration: 'underline' },
})

export function WorkflowRunPage(handle: Handle<WorkflowRunPageProps>) {
  return () => {
    let { run, error } = handle.props
    return (
    <div>
      {error ? (
        <div mix={errorCardStyle}>
          <h1 mix={errorTitleStyle}>Fehler</h1>
          <p mix={errorMessageStyle}>{error}</p>
            <a href={routes.ai.workflow.index.href()} mix={backLinkStyle}>&larr; Zurück zu Workflows</a>
        </div>
      ) : run ? (
        <div>
          <div mix={runHeaderStyle}>
            <h1 mix={pageTitleStyle}>Workflow-Ausführung</h1>
            <span mix={[statusBadgeBaseStyle,
              run.status === 'pending' ? statusPendingStyle
              : run.status === 'running' ? statusRunningStyle
              : run.status === 'completed' ? statusCompletedStyle
              : statusFailedStyle
            ]}>{run.status}</span>
          </div>

          <div mix={infoGridStyle}>
            <div mix={infoItemStyle}><span mix={infoLabelStyle}>Workflow</span><span mix={infoValueStyle}>{run.workflow_id}</span></div>
            <div mix={infoItemStyle}><span mix={infoLabelStyle}>Gestartet</span><span mix={infoValueStyle}>{new Date(Number(run.created_at)).toLocaleString('de-DE')}</span></div>
            {run.completed_at ? (
              <div mix={infoItemStyle}><span mix={infoLabelStyle}>Abgeschlossen</span><span mix={infoValueStyle}>{new Date(Number(run.completed_at)).toLocaleString('de-DE')}</span></div>
            ) : null}
          </div>

          {run.params != null && run.params !== '{}' && (
            <div mix={sectionStyle}>
              <h2 mix={sectionTitleStyle}>Parameter</h2>
              <pre mix={codeBlockStyle}>{(() => { try { return JSON.stringify(typeof run.params === 'string' ? JSON.parse(run.params) : run.params, null, 2) } catch { return run.params } })()}</pre>
            </div>
          )}

          {run.steps != null && run.steps !== '[]' && (
            <div mix={sectionStyle}>
              <h2 mix={sectionTitleStyle}>Schritte</h2>
              <div mix={stepsListStyle}>
                {(() => {
                  let steps = []
                  try { steps = typeof run.steps === 'string' ? JSON.parse(run.steps) : run.steps } catch {}
                  return (Array.isArray(steps) ? steps : []).map((step, index) => (
                    <div mix={stepCardStyle} key={step.id}>
                      <div mix={stepHeaderStyle}>
                        <span mix={stepNumberStyle}>{index + 1}</span>
                        <span mix={stepNameStyle}>{step.name}</span>
                        <span mix={[stepStatusStyle,
                          step.status === 'pending' ? statusPendingStyle
                          : step.status === 'running' ? statusRunningStyle
                          : step.status === 'completed' ? statusCompletedStyle
                          : statusFailedStyle
                        ]}>{step.status}</span>
                      </div>
                      {step.output ? (
                        <div mix={stepOutputStyle}>
                          <pre mix={codeBlockStyle}>{typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}</pre>
                        </div>
                      ) : null}
                      {step.error && <div mix={stepErrorStyle}>{step.error}</div>}
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}

          {run.result != null && run.result !== 'null' && (
            <div mix={sectionStyle}>
              <h2 mix={sectionTitleStyle}>Ergebnis</h2>
              <pre mix={codeBlockStyle}>{(() => { try { return JSON.stringify(typeof run.result === 'string' ? JSON.parse(run.result) : run.result, null, 2) } catch { return run.result } })()}</pre>
            </div>
          )}

          {run.error && (
            <div mix={sectionStyle}>
              <h2 mix={sectionTitleStyle}>Fehler</h2>
              <div mix={errorMessageStyle}>{run.error}</div>
            </div>
          )}

          {run.status === 'running' && <meta httpEquiv="refresh" content="3" />}

          <div mix={actionsStyle}>
            <a href={routes.ai.workflow.index.href()} mix={backLinkStyle}>&larr; Zurück zu Workflows</a>
          </div>
        </div>
      ) : null}
    </div>
  )
  }
}
