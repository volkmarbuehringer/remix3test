import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import button from '../ui/theme/button.ts'
import { routes, frames } from '../routes.ts'
import type { ChatMessage } from '../types/chatlog.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import { ChatlogRowDetail } from '../assets/chatlog-row-detail.tsx'
import { ConfirmDelete } from '../assets/confirm-delete.tsx'
interface ChatLogPageProps {
  conversations: Array<{
    id: string
    conversation: ChatMessage[]
    created_at: number
    updated_at: number
  }>
  page: number
  hasMore: boolean
}

const pageStyle = css({ maxWidth: '900px', margin: '0 auto', padding: theme.space.lg })
const pageTitleStyle = css({ fontSize: theme.fontSize.xxl, fontWeight: 600, margin: `0 0 ${theme.space.lg}`, color: theme.colors.text.primary })

const resultCountStyle = css({ fontSize: theme.fontSize.md, color: theme.colors.text.secondary, margin: `0 0 ${theme.space.md}` })
const emptyStateStyle = css({ color: theme.colors.text.secondary, padding: theme.space.xl, textAlign: 'center' })

const paginationStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.md,
  marginTop: theme.space.lg,
})

const pageLinkStyle = css({
  padding: `${theme.space.sm} ${theme.space.md}`,
  backgroundColor: theme.colors.action.primary.background,
  color: theme.surface.lvl0,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
  textDecoration: 'none',
  '&:hover': { opacity: 0.9 },
})

const pageLinkDisabledStyle = css({
  opacity: 0.4,
  cursor: 'not-allowed',
  pointerEvents: 'none',
})

const pageLabelStyle = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.secondary,
})

const conversationItemStyle = css({ marginBottom: theme.space.lg, padding: theme.space.lg, border: `1px solid ${theme.colors.border.default}`, borderRadius: theme.radius.sm })
const conversationHeaderStyle = css({ fontSize: theme.fontSize.lg, margin: `0 0 ${theme.space.sm}`, display: 'flex', alignItems: 'center', gap: theme.space.sm })
const conversationLinkStyle = css({ color: theme.colors.action.primary.background, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } })
const conversationMetaStyle = css({ fontSize: theme.fontSize.md, color: theme.colors.text.secondary, margin: `0 0 ${theme.space.sm}` })

function ChatLogPage(handle: Handle<ChatLogPageProps>) {
  return () => {
    let { conversations, page, hasMore } = handle.props
    let pageHref = (p: number) => {
      let params = new URLSearchParams()
      params.set('page', String(p))
      return `${routes.admin.chatlog.index.href()}?${params.toString()}`
    }

    return (
      <div>
        <ConfirmDelete />
        <div mix={pageStyle}>
          <h1 mix={pageTitleStyle}>Chat-Konversationen</h1>
          <p mix={resultCountStyle}>Seite {page}</p>

          {conversations.length === 0 ? (
            <p mix={emptyStateStyle}>Noch keine Konversationen.</p>
          ) : (
            <ul mix={css({ listStyle: 'none', padding: 0, margin: 0 })}>
              {conversations.map(conv => {
                let link = `${routes.mastra.chat.index.href()}?threadId=${conv.id}`
                return (
                  <li key={conv.id} mix={conversationItemStyle}>
                    <div mix={conversationHeaderStyle}>
                      <a href={link} mix={conversationLinkStyle}>Konversation #{conv.id}</a>
                    </div>
                    <p mix={conversationMetaStyle}>
                      Erstellt: {new Date(conv.created_at).toLocaleString('de-DE')} &bull; Aktualisiert: {new Date(conv.updated_at).toLocaleString('de-DE')}
                    </p>
                    <div mix={css({ display: 'flex', gap: '0.5rem', alignItems: 'center' })}>
                      <form
                        method="POST"
                        action={routes.admin.chatlog.destroy.href({ id: conv.id })}
                        rmx-target={frames.adminContent}
                        data-confirm={`Konversation #${conv.id} löschen?`}
                      >
                        <CsrfTokenInput />
                        <button type="submit" mix={[button({ tone: 'danger' })]}>Löschen</button>
                      </form>
                      <ChatlogRowDetail conversationId={conv.id} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {(hasMore || page > 1) && (
            <div mix={paginationStyle}>
              {page > 1 ? (
                  <a href={pageHref(page - 1)} rmx-target={frames.adminContent} mix={pageLinkStyle}>
                    ← Zurück
                  </a>
                ) : (
                  <span mix={[pageLinkStyle, pageLinkDisabledStyle]}>← Zurück</span>
                )}
                <span mix={pageLabelStyle}>Seite {page}</span>
                {hasMore ? (
                  <a href={pageHref(page + 1)} rmx-target={frames.adminContent} mix={pageLinkStyle}>
                    Weiter →
                  </a>
                ) : (
                  <span mix={[pageLinkStyle, pageLinkDisabledStyle]}>Weiter →</span>
                )}
            </div>
          )}
        </div>
      </div>
    )
  }
}

export { ChatLogPage }
