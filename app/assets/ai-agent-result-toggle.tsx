import { clientEntry, Frame, css, on, type Handle } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { routes } from '../routes.ts'

/**
 * A toggle client entry that mounts/unmounts a Frame showing AI agent results.
 *
 * Usage: Place this on the agent page. When `showResult` is true, a `<Frame>`
 * is rendered that loads the agent result fragment. A close button unmounts it.
 */
export const AiAgentResultToggle = clientEntry(
  import.meta.url,
  function AiAgentResultToggle(handle: Handle) {
    let showResult = false
    let currentPrompt = ''

    return () => {
      // Guard against SSR — document is not available during server rendering
      let prompt: string
      if (typeof document !== 'undefined') {
        let promptInput = document.querySelector<HTMLTextAreaElement>('#message')
        prompt = promptInput?.value?.trim() ?? currentPrompt
      } else {
        prompt = currentPrompt
      }

      return (
        <div
          mix={css({
            marginTop: '1rem',
            borderTop: `1px solid #e2e8f0`,
            paddingTop: '1rem',
          })}
        >
          <div
            mix={css({
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              marginBottom: showResult ? '0.75rem' : 0,
            })}
          >
            {!showResult ? (
              <button
                type="button"
                mix={[
                  css({
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${theme.colors.border.default}`,
                    background: theme.colors.action.primary.background,
                    color: theme.colors.action.primary.foreground,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    '&:hover': { background: theme.colors.action.primary.backgroundHover },
                  }),
                  on('click', () => {
                    currentPrompt = prompt
                    showResult = true
                    handle.update()
                  }),
                ]}
              >
                ▶ Run Agent
              </button>
            ) : (
              <button
                type="button"
                mix={[
                  css({
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${theme.colors.border.default}`,
                    background: theme.surface.lvl1,
                    color: theme.colors.text.muted,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    '&:hover': { background: theme.surface.lvl2 },
                  }),
                  on('click', () => {
                    showResult = false
                    currentPrompt = ''
                    handle.update()
                  }),
                ]}
              >
                ✕ Close Result
              </button>
            )}
          </div>

          {showResult ? (
            <Frame
              name="ai-agent-result"
              src={routes.ai.fragments.agentResult.href(undefined, {
                prompt: currentPrompt || 'Direct agent execution',
              })}
              fallback={
                <div
                  mix={css({
                    padding: '1.5rem',
                    background: theme.surface.lvl1,
                    borderRadius: '0.75rem',
                    border: `1px solid ${theme.colors.border.default}`,
                    color: theme.colors.text.muted,
                    fontSize: '0.875rem',
                  })}
                >
                  Running agent…
                </div>
              }
            />
          ) : null}
        </div>
      )
    }
  },
)
