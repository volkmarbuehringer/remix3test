import { css } from 'remix/component'

import { theme } from '../theme/theme.ts'

/**
 * Descendant-class rules for the agent surfaces that build markup as strings
 * (`customer-chat-render.ts`, `agent-events-log.ts`). A string-built
 * `style="…"` attribute would be blocked by `style-src-attr 'none'`, so the
 * generated HTML carries class names and these `css()` mixins style them from
 * the nearest container (`#chat-messages`, the agent-events frame container).
 *
 * Class names are namespaced per surface; only the active surface renders its
 * rules because each mixin is attached to that surface's container.
 */
export const customerChatStreamStyles = css({
  '.chat-tool-icon': { opacity: 0.6, fontSize: '1em' },
  '.chat-tool-caret': {
    marginLeft: 'auto',
    fontSize: '0.75rem',
    transition: 'transform 0.15s',
  },
  '.chat-slots-hint': { fontSize: '0.8125rem', color: theme.colors.text.secondary },
  '.chat-slot-title': { fontWeight: 600, fontSize: '1rem', marginBottom: '0.5rem' },
  '.chat-slot-day': { fontSize: '0.85rem', fontWeight: 600, margin: '0.5rem 0 0.25rem' },
  '.chat-slot-btn': {
    display: 'inline-block',
    margin: '0.2rem',
    padding: '0.5rem 1rem',
    background: theme.surface.lvl1,
    color: theme.colors.text.primary,
    border: `1px solid ${theme.colors.border.default}`,
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 500,
  },
  '.chat-slot-pagination': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    marginTop: '0.75rem',
    fontSize: '0.85rem',
  },
  '.chat-page-btn': {
    padding: '0.3rem 0.75rem',
    background: theme.surface.lvl1,
    color: theme.colors.text.primary,
    border: `1px solid ${theme.colors.border.default}`,
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.85rem',
    '&:disabled': { opacity: 0.5 },
  },
  '.chat-slot-actions': {
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'flex-end',
    marginTop: '0.75rem',
    paddingTop: '0.5rem',
    borderTop: `1px solid ${theme.colors.border.default}`,
  },
  '.chat-slot-other': {
    padding: '0.4rem 0.75rem',
    background: theme.surface.lvl1,
    color: theme.colors.text.primary,
    border: `1px solid ${theme.colors.border.default}`,
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  '.chat-slot-close': {
    padding: '0.4rem 0.75rem',
    background: 'transparent',
    color: theme.colors.text.secondary,
    border: `1px solid ${theme.colors.border.default}`,
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  '.chat-cancel': {
    padding: '0.25rem 0.75rem',
    background: 'transparent',
    color: theme.colors.text.secondary,
    border: `1px solid ${theme.colors.border.default}`,
    borderRadius: 6,
    fontSize: '0.8125rem',
    cursor: 'pointer',
  },
})

export const agentEventsStreamStyles = css({
  '.ae-log': {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflowY: 'auto',
    padding: '1rem 1.25rem',
    boxSizing: 'border-box',
  },
  '.ae-row': {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.5rem',
    padding: '0.25rem 0',
    fontSize: '0.8125rem',
    lineHeight: 1.4,
  },
  '.ae-badge': { flex: '0 0 1rem', textAlign: 'center', fontWeight: 600 },
  '.ae-badge-success': { color: theme.colors.success.background },
  '.ae-badge-active': { color: theme.colors.action.primary.background },
  '.ae-badge-error': { color: theme.colors.action.danger.background },
  '.ae-badge-info': { color: theme.colors.text.muted },
  '.ae-time': {
    flex: '0 0 4.5rem',
    fontFamily: theme.fontFamily.mono,
    fontSize: '0.75rem',
    color: theme.colors.text.muted,
  },
  '.ae-text': { color: theme.colors.text.primary, wordBreak: 'break-word' },
  '.ae-text-error': { color: theme.colors.action.danger.background },
})
