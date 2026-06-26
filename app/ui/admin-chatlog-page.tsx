import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../lib/theme.ts'
import button from '../lib/button.ts'
import { routes, frames } from '../routes.ts'
import type { ChatMessage } from '../lib/chatlog.ts'
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
  filter?: string
  type?: 'chat' | 'agent'
  page: number
  hasMore: boolean
}

function decode(text: string): string {
  let result = text
  result = result.replace(/&#39;/g, "'").replace(/&#039;/g, "'").replace(/&#x27;/gi, "'")
  result = result.replace(/&#34;/g, '"').replace(/&quot;/g, '"')
  result = result.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  return result
}

const pageStyle = css({ maxWidth: '900px', margin: '0 auto', padding: theme.space.lg })
const pageTitleStyle = css({ fontSize: theme.fontSize.xxl, fontWeight: 600, margin: `0 0 ${theme.space.lg}`, color: theme.colors.text.primary })

const filterFormStyle = css({ marginBottom: theme.space.lg, display: 'flex', alignItems: 'center', gap: theme.space.sm })
const filterInputStyle = css({
  padding: theme.space.sm, fontSize: theme.fontSize.xl, width: '300px',
  border: `1px solid ${theme.colors.border.default}`, borderRadius: theme.radius.md,
  '&:focus': { outline: 'none', borderColor: theme.colors.action.primary.background, boxShadow: `0 0 0 3px ${theme.colors.focus.ring}33` },
})

const clearLinkStyle = css({ marginLeft: theme.space.lg, color: theme.colors.action.primary.background, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } })
const typeFilterLabelStyle = css({ fontSize: theme.fontSize.md, color: theme.colors.text.secondary, margin: `0 0 ${theme.space.sm}`, display: 'flex', alignItems: 'center' })
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
const badgeStyle = css({ padding: `${theme.space.sm} ${theme.space.sm}`, fontSize: theme.fontSize.xs, fontWeight: 500, borderRadius: theme.radius.full, background: theme.colors.action.primary.background, color: theme.surface.lvl0 })
const agentBadgeStyle = css({ background: theme.colors.action.primary.backgroundHover })
const conversationMetaStyle = css({ fontSize: theme.fontSize.md, color: theme.colors.text.secondary, margin: `0 0 ${theme.space.sm}` })

const detailsSummaryStyle = css({ cursor: 'pointer', color: theme.colors.action.primary.background, fontWeight: 500 })
const messageItemStyle = css({ marginBottom: theme.space.md, padding: theme.space.sm, background: theme.surface.lvl1, borderRadius: theme.radius.sm })
const messageLabelStyle = css({ fontWeight: 600, fontSize: theme.fontSize.md, margin: `0 0 ${theme.space.sm}` })
const messageContentStyle = css({ margin: 0, whiteSpace: 'pre-wrap' })
const messageTimestampStyle = css({ fontWeight: 400, color: theme.colors.text.muted, marginLeft: theme.space.sm, fontSize: theme.fontSize.xs })
const elapsedTimeStyle = css({ fontWeight: 400, color: theme.colors.text.secondary, marginLeft: theme.space.sm, fontSize: theme.fontSize.xs })
const tokenBadgeStyle = css({ fontWeight: 400, color: theme.colors.text.secondary, marginLeft: theme.space.sm, fontSize: theme.fontSize.xs, background: theme.surface.lvl1, padding: `${theme.space.xs} ${theme.space.sm}`, borderRadius: theme.radius.full })
const toolCallBadgeStyle = css({ fontWeight: 400, color: theme.colors.text.secondary, marginLeft: theme.space.sm, fontSize: theme.fontSize.xxs })
const toolDetailsStyle = css({ marginTop: theme.space.sm, padding: theme.space.sm, background: theme.surface.lvl1, borderRadius: theme.radius.sm })
const toolDetailItemStyle = css({ marginTop: theme.space.sm })
const toolNameStyle = css({ fontWeight: 600, color: theme.colors.text.primary })
const toolInputStyle = css({ margin: `${theme.space.sm} 0 0`, padding: theme.space.sm, background: theme.surface.lvl0, borderRadius: '2px', fontSize: theme.fontSize.xxs, overflow: 'auto' })
const toolResultStyle = css({ marginTop: theme.space.sm, padding: theme.space.sm, background: theme.surface.lvl1, borderRadius: '2px' })
const toolResultLabelStyle = css({ fontWeight: 600, fontSize: theme.fontSize.xxs, color: theme.colors.text.primary })
const toolResultContentStyle = css({ margin: `${theme.space.sm} 0 0`, padding: theme.space.sm, background: theme.surface.lvl0, borderRadius: '2px', fontSize: theme.fontSize.xxs, overflow: 'auto' })

function ChatLogPage(handle: Handle<ChatLogPageProps>) {
  return () => {
    let { conversations, filter, type, page, hasMore } = handle.props
    let pageHref = (p: number) => {
      let params = new URLSearchParams()
      params.set('page', String(p))
      if (filter) params.set('filter', filter)
      if (type) params.set('type', type)
      return `${routes.admin.chatlog.index.href()}?${params.toString()}`
    }

    return (
      <div>
        <ConfirmDelete />
        <div mix={pageStyle}>
          <h1 mix={pageTitleStyle}>Chat-Konversationen</h1>
 
          <form method="get" mix={filterFormStyle}>
            <input type="text" name="filter" placeholder="Konversationen durchsuchen..." defaultValue={filter ?? ''} mix={filterInputStyle} />
            <button type="submit" mix={[button({ tone: 'primary' })]}>Suchen</button>
            {filter && <a href={routes.admin.chatlog.index.href()} mix={clearLinkStyle}>Filter zurücksetzen</a>}
          </form>
 
          {type && (
            <p mix={typeFilterLabelStyle}>
              Angezeigt: {type === 'chat' ? 'Chat' : 'Agent'}-Konversationen
              <a href={routes.admin.chatlog.index.href()} mix={clearLinkStyle}>Filter zurücksetzen</a>
            </p>
          )}
          <p mix={resultCountStyle}>Seite {page}</p>
 
          {conversations.length === 0 ? (
            <p mix={emptyStateStyle}>Noch keine Konversationen.</p>
          ) : (
            <ul mix={css({ listStyle: 'none', padding: 0, margin: 0 })}>
              {conversations.map(conv => {
                let hasToolCalls = conv.conversation.some(msg => msg.toolCalls && msg.toolCalls.length > 0)
                let link = hasToolCalls ? `/ai/agent?agentId=${conv.id}` : `/ai/chat?chatId=${conv.id}`
                return (
                  <li key={conv.id} mix={conversationItemStyle}>
                    <div mix={conversationHeaderStyle}>
                      <a href={link} mix={conversationLinkStyle}>Konversation #{conv.id}</a>
                      <span mix={hasToolCalls ? [badgeStyle, agentBadgeStyle] : badgeStyle}>{hasToolCalls ? 'Agent' : 'Chat'}</span>
                    </div>
                    <p mix={conversationMetaStyle}>
                      Erstellt: {new Date(conv.created_at).toLocaleString('de-DE')} &bull; Aktualisiert: {new Date(conv.updated_at).toLocaleString('de-DE')} &bull; {conv.conversation.length} Nachricht(en)
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
                    <details>
                      <summary mix={detailsSummaryStyle}>{conv.conversation.length} Nachricht(en) anzeigen</summary>
                      <ul mix={css({ marginTop: theme.space.sm, paddingLeft: theme.space.lg, listStyle: 'none' })}>
                        {conv.conversation.map((msg, idx) => (
                          <li key={idx} mix={messageItemStyle}>
                            <p mix={messageLabelStyle}>
                              {msg.role === 'user' ? 'Benutzer' : 'Assistent'}
                              {msg.timestamp && <span mix={messageTimestampStyle}>{new Date(msg.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>}
                              {msg.elapsed && <span mix={elapsedTimeStyle}>({msg.elapsed < 1000 ? `${msg.elapsed}ms` : `${(msg.elapsed / 1000).toFixed(1)}s`})</span>}
                              {msg.tokens && <span mix={tokenBadgeStyle} title={`Eingabe: ${msg.tokens.input}, Ausgabe: ${msg.tokens.output}`}>{msg.tokens.total} Tokens</span>}
                              {msg.toolCalls && msg.toolCalls.length > 0 && <span mix={toolCallBadgeStyle}>{msg.toolCalls.map(tc => tc.name).join(', ')}</span>}
                            </p>
                            <p mix={messageContentStyle}>{decode(msg.content)}</p>
                            {msg.toolCalls && msg.toolCalls.length > 0 && (
                              <div mix={toolDetailsStyle}>
                                {msg.toolCalls.map((tc, tidx) => (
                                  <div key={tidx} mix={toolDetailItemStyle}>
                                    <span mix={toolNameStyle}>{tc.name}</span>
                                    <pre mix={toolInputStyle}>{JSON.stringify(tc.input, null, 2)}</pre>
                                    {tc.result !== undefined && <div mix={toolResultStyle}><span mix={toolResultLabelStyle}>Ergebnis:</span><pre mix={toolResultContentStyle}>{JSON.stringify(tc.result, null, 2)}</pre></div>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
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
