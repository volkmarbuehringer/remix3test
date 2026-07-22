import { clientEntry, Frame, css, on, type Handle, type SerializableProps } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'

interface ChatlogRowDetailProps extends SerializableProps {
  conversationId: string
}

/**
 * Toggle client entry for admin chatlog rows.
 * Clicking "Detail" mounts a Frame showing the full conversation.
 * Clicking "Close" unmounts and removes it.
 */
export const ChatlogRowDetail = clientEntry(
  import.meta.url,
  function ChatlogRowDetail(handle: Handle<ChatlogRowDetailProps>) {
    let showDetail = false

    return () => {
      let { conversationId } = handle.props

      return (
        <span>
          <button
            type="button"
            mix={[
              css({
                background: 'none',
                border: 'none',
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                color: theme.colors.action.primary.background,
                cursor: 'pointer',
                textDecoration: 'underline',
                '&:hover': { color: theme.colors.action.primary.backgroundHover },
              }),
              on('click', () => {
                showDetail = !showDetail
                handle.update()
              }),
            ]}
          >
            {showDetail ? '✕ Close Detail' : '📄 Detail'}
          </button>

          {showDetail ? (
            <div
              mix={css({
                marginTop: '0.75rem',
                marginBottom: '0.5rem',
              })}
            >
              <Frame
                name={`chatlog-detail-${conversationId}`}
                src={`/admin/chatlog/fragments/detail/${conversationId}`}
                fallback={
                  <div
                    mix={css({
                      padding: '1rem',
                      background: theme.surface.lvl1,
                      borderRadius: '0.5rem',
                      border: `1px solid ${theme.colors.border.default}`,
                      color: theme.colors.text.muted,
                      fontSize: '0.875rem',
                    })}
                  >
                    Loading conversation detail…
                  </div>
                }
              />
            </div>
          ) : null}
        </span>
      )
    }
  },
)
