import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { Glyph } from '../ui/theme/glyph.ts'
import button from '../ui/theme/button.ts'

import { routes } from '../routes.ts'
import { FormLoadingState } from './form-loading-state.tsx'
import { WorkflowParameters } from './workflow-parameters.tsx'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import type { WorkflowDefinition } from '../workflows/types.ts'
import type { WorkflowRun } from '../workflows/engine.ts'

export interface WorkflowPageProps {
  workflows: WorkflowDefinition[]
  recentRuns: WorkflowRun[]
}

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: theme.surface.lvl1, text: theme.colors.text.muted },
  running: { bg: theme.surface.lvl1, text: theme.colors.text.secondary },
  completed: { bg: theme.surface.lvl1, text: theme.colors.text.primary },
  failed: { bg: theme.surface.lvl1, text: theme.colors.action.danger.foreground },
}

function statusBadgeStyle(bg: string, text: string) {
  return css({ background: bg, color: text })
}

const pageGridStyles = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: theme.space.lg,
  '@media (max-width: 900px)': { gridTemplateColumns: '1fr' },
})

const sectionCardStyles = css({
  background: theme.surface.lvl0,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.xl,
  boxShadow: theme.shadow.sm,
  overflow: 'hidden',
})

const sectionHeaderStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.md,
  padding: `${theme.space.lg} ${theme.space.lg}`,
  borderBottom: `1px solid ${theme.colors.border.default}`,
  background: theme.surface.lvl1,
  '& h2': {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.primary,
    margin: '0',
  },
})

const sectionIconStyles = css({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: theme.space.xl, height: theme.space.xl,
  background: `${theme.colors.focus.ring}33`,
  color: theme.colors.action.primary.background,
  borderRadius: theme.radius.md,
})

const emptyStateStyles = css({
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', textAlign: 'center',
  padding: `${theme.space.xxl} ${theme.space.lg}`,
})

const emptyIconStyles = css({
  color: theme.colors.text.muted, marginBottom: theme.space.lg, opacity: '0.5',
})

const formStyles = css({
  padding: theme.space.lg, display: 'flex', flexDirection: 'column', gap: theme.space.lg,
})

const formGroupStyles = css({
  display: 'flex', flexDirection: 'column', gap: theme.space.sm,
})

const formLabelStyles = css({
  fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, color: theme.colors.text.primary,
})

const selectWrapperStyles = css({ position: 'relative' })

const selectStyles = css({
  width: '100%', padding: `${theme.space.md} ${theme.space.xl} ${theme.space.md} ${theme.space.lg}`,
  fontSize: theme.fontSize.lg, color: theme.colors.text.primary,
  background: theme.surface.lvl1, border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md, appearance: 'none', cursor: 'pointer',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  '&:focus': {
    outline: 'none', borderColor: theme.colors.action.primary.background,
    boxShadow: `0 0 0 3px ${theme.colors.focus.ring}33`,
  },
})

const selectArrowStyles = css({
  position: 'absolute', right: theme.space.md, top: '50%',
  transform: 'translateY(-50%)', color: theme.colors.text.muted, pointerEvents: 'none',
})

const parametersContainerStyles = css({
  border: `1px solid ${theme.colors.border.default}`, borderRadius: theme.radius.md,
  overflow: 'hidden', animation: 'fadeIn 0.2s ease-out', display: 'none',
  '@keyframes fadeIn': {
    from: { opacity: '0', transform: 'translateY(-8px)' },
    to: { opacity: '1', transform: 'translateY(0)' },
  },
})

const parametersHeaderStyles = css({
  display: 'flex', alignItems: 'center', gap: theme.space.sm,
  padding: `${theme.space.sm} ${theme.space.md}`, background: theme.surface.lvl2,
  color: theme.colors.text.secondary, fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: '0.05em',
})

const parametersListStyles = css({
  padding: theme.space.md, display: 'flex', flexDirection: 'column', gap: theme.space.md,
})

const runsListStyles = css({ display: 'flex', flexDirection: 'column' })

const runCardStyles = css({
  display: 'flex', flexDirection: 'column', gap: theme.space.sm,
  padding: `${theme.space.lg} ${theme.space.lg}`, textDecoration: 'none', color: 'inherit',
  borderBottom: `1px solid ${theme.colors.border.default}`,
  transition: 'background-color 0.15s ease', position: 'relative',
  '&:last-child': { borderBottom: 'none' },
  '&:hover': { background: theme.surface.lvl1 },
  '&:hover > svg:last-child': { opacity: '1' },
})

const runCardHeaderStyles = css({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.md,
})

const runWorkflowStyles = css({
  fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text.primary,
})

const runStatusStyles = css({
  fontSize: theme.fontSize.xxs, fontWeight: theme.fontWeight.semibold,
  padding: `${theme.space.sm} ${theme.space.sm}`, borderRadius: theme.radius.full,
  textTransform: 'capitalize',
})

const runCardMetaStyles = css({
  display: 'flex', alignItems: 'center', gap: theme.space.lg, flexWrap: 'wrap',
})

const runMetaStyles = css({
  display: 'flex', alignItems: 'center', gap: theme.space.sm,
  fontSize: theme.fontSize.xs, color: theme.colors.text.muted,
})

const runArrowStyles = css({
  position: 'absolute', right: theme.space.lg, top: '50%', transform: 'translateY(-50%)',
  color: theme.colors.text.muted, opacity: '0', transition: 'opacity 0.15s ease',
  '@media (max-width: 640px)': { display: 'none' },
})

export function WorkflowPage(handle: Handle<WorkflowPageProps>) {
  return () => {
    let { workflows, recentRuns } = handle.props
    return (
    <div>
      <div mix={pageGridStyles}>
        <section>
          <div mix={sectionCardStyles}>
            <div mix={sectionHeaderStyles}>
              <div mix={sectionIconStyles}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </div>
              <h2>Workflow ausführen</h2>
            </div>

            {workflows.length === 0 ? (
              <div mix={emptyStateStyles}>
                <div mix={emptyIconStyles}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>
                <p>Noch keine Workflows registriert.</p>
                <span>Später nochmal prüfen oder einen Administrator kontaktieren.</span>
              </div>
            ) : (
              <form method="POST" action={routes.ai.workflow.action.href()} id="workflow-form" mix={formStyles}>
                <CsrfTokenInput />
                <div mix={formGroupStyles}>
                  <label for="workflow-select" mix={formLabelStyles}>Workflow auswählen</label>
                  <div mix={selectWrapperStyles}>
                    <select id="workflow-select" name="workflowId" required mix={selectStyles}>
                      <option value="">Workflow wählen…</option>
                      {workflows.map(w => (
                        <option value={w.id} key={w.id} data-description={w.description || ''} data-parameters={JSON.stringify(w.parameters || [])}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                    <Glyph name="chevronDown" width={16} height={16} mix={selectArrowStyles} />
                  </div>
                </div>

                <div id="parameters-container" mix={parametersContainerStyles}>
                  <div mix={parametersHeaderStyles}>
                    <Glyph name="menu" width={16} height={16} />
                    <span>Parameter</span>
                  </div>
                  <div id="parameters-list" mix={parametersListStyles} />
                </div>

                <button type="submit" id="run-button" data-loading-text="Wird ausgeführt…" mix={[button({ tone: 'primary' })]}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Workflow ausführen
                </button>
              </form>
            )}
          </div>
        </section>

        <section>
          <div mix={sectionCardStyles}>
            <div mix={sectionHeaderStyles}>
              <div mix={sectionIconStyles}>
                <Glyph name="clock" width={24} height={24} />
              </div>
              <h2>Letzte Ausführungen</h2>
            </div>

            {recentRuns.length === 0 ? (
              <div mix={emptyStateStyles}>
                <div mix={emptyIconStyles}>
                  <Glyph name="clock" width={48} height={48} />
                </div>
                <p>Noch keine Ausführungen.</p>
                <span>Wähle oben einen Workflow, um zu beginnen.</span>
              </div>
            ) : (
              <div mix={runsListStyles}>
                {recentRuns.map(run => {
                  let statusStyle = statusColors[run.status] || statusColors.pending
                  return (
                    <a key={run.id} href={`/ai/workflow?runId=${run.id}`} mix={runCardStyles}>
                      <div mix={runCardHeaderStyles}>
                        <span mix={runWorkflowStyles}>{run.workflow_id}</span>
                        <span mix={[runStatusStyles, statusBadgeStyle(statusStyle.bg, statusStyle.text)]}>
                          {run.status}
                        </span>
                      </div>
                      <div mix={runCardMetaStyles}>
                        <span mix={runMetaStyles}>
                          <Glyph name="user" width={12} height={12} />
                          {run.id.slice(0, 8)}...
                        </span>
                        <span mix={runMetaStyles}>
                          <Glyph name="clock" width={12} height={12} />
                          {new Date(Number(run.created_at)).toLocaleString('de-DE')}
                        </span>
                      </div>
                      <Glyph name="chevronRight" width={16} height={16} mix={runArrowStyles} />
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <WorkflowParameters />
    </div>
  )
  }
}
