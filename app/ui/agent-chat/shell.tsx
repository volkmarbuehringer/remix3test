import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'

import { theme } from '../theme/theme.ts'

// ── Shell ─────────────────────────────────────────────────────────────
//
// The three agent surfaces (customer `/chat`, admin `/admin/support-agent`,
// admin `/admin/agent-events`) share one page skeleton: an outer column that
// either fills the admin sidebar shell or scrolls as a centered document, an
// optional header, a main content region, an optional hint, a composer, and the
// client stream entry. Individual pages own their header and main content; this
// module owns the shared skeleton, composer, and message bubbles.

const fullHeightPageStyle = css({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
})

const centeredPageStyle = css({
  maxWidth: '800px',
  margin: '0 auto',
  padding: '1rem',
})

export type AgentChatShellProps = {
  /**
   * `fullHeight` fills the available area inside the admin sidebar shell (the
   * page must also be registered in the shell's `fullHeightTargets`).
   * `centered` is the standalone customer column rendered in the plain Layout.
   */
  variant?: 'fullHeight' | 'centered'
  /** Page header (title, subtitle, actions). */
  header?: RemixNode
  /** Main content region — frame container, transcript, status bar, etc. */
  children?: RemixNode
  /** Optional hint strip rendered above the composer. */
  hint?: RemixNode
  /** Composer form. */
  composer?: RemixNode
  /** Client stream entry (renders an inert element). */
  stream?: RemixNode
}

/**
 * The shared agent-chat page skeleton. It is intentionally slot-based: each
 * agent keeps its own header and main region while sharing the outer layout so
 * full-height geometry and the composer stay consistent.
 */
export function AgentChatShell(handle: Handle<AgentChatShellProps>) {
  return () => {
    let { variant = 'fullHeight', header, children, hint, composer, stream } = handle.props
    return (
      <div mix={variant === 'centered' ? centeredPageStyle : fullHeightPageStyle}>
        {header}
        {children}
        {hint}
        {composer}
        {stream}
      </div>
    )
  }
}

// ── Message bubbles ───────────────────────────────────────────────────

export type MessageBubbleRole = 'user' | 'assistant' | 'error'
export type MessageBubbleVariant = 'customer' | 'support'

/**
 * Inline bubble style. Returned as an object (not a `css()` class) so the
 * server-rendered transcript and any streamed-in bubble can share one source
 * without fighting the cascade-layer ordering of generated classes.
 */
export function bubbleStyle(
  role: MessageBubbleRole,
  variant: MessageBubbleVariant = 'support',
): Record<string, string | number | undefined> {
  let isUser = role === 'user'
  let isError = role === 'error'
  let background = isError
    ? theme.colors.action.danger.background
    : isUser
      ? theme.colors.action.primary.background
      : theme.surface.lvl1
  let color = isError
    ? theme.colors.action.danger.foreground
    : isUser
      ? theme.colors.action.primary.foreground
      : theme.colors.text.primary

  if (variant === 'customer') {
    return {
      padding: '0.75rem',
      borderRadius: '12px',
      maxWidth: '75%',
      lineHeight: 1.5,
      fontSize: '0.9375rem',
      background,
      color,
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      borderBottomRightRadius: isUser ? '4px' : undefined,
      borderBottomLeftRadius: isUser ? undefined : '4px',
      border: isError ? `1px solid ${theme.colors.action.danger.border}` : undefined,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }
  }

  return {
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    maxWidth: '75%',
    lineHeight: '1.4',
    fontSize: '0.875rem',
    background,
    color,
    alignSelf: isUser ? 'flex-end' : 'flex-start',
    border: isUser ? undefined : `1px solid ${theme.colors.border.subtle}`,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }
}

export type MessageBubbleProps = {
  role: MessageBubbleRole
  variant?: MessageBubbleVariant
  children?: RemixNode
}

/** A single server-rendered transcript bubble. */
export function MessageBubble(handle: Handle<MessageBubbleProps>) {
  return () => {
    let { role, variant = 'support', children } = handle.props
    return (
      <div style={bubbleStyle(role, variant)} role={role === 'error' ? 'alert' : undefined}>
        {children}
      </div>
    )
  }
}

// ── Composer ──────────────────────────────────────────────────────────

// Inline composer (admin agents): textarea + submit in one row.
const inlineFormStyle = css({
  display: 'flex',
  gap: '0.5rem',
  padding: '0.75rem 1rem',
  background: theme.surface.lvl0,
  borderTop: `1px solid ${theme.colors.border.default}`,
  flexShrink: 0,
})

const inlineTextareaStyle = css({
  flex: 1,
  padding: '0.6rem 0.75rem',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  fontFamily: 'inherit',
  fontSize: '0.9375rem',
  color: theme.colors.text.primary,
  background: theme.surface.lvl1,
  outline: 'none',
  boxSizing: 'border-box',
  resize: 'none',
  lineHeight: '1.4',
  minHeight: '3.6rem',
  maxHeight: '10rem',
  overflowY: 'auto',
  '&:focus': { borderColor: theme.colors.focus.ring },
  '&:disabled': { opacity: 0.6 },
})

const inlineButtonStyle = css({
  padding: '0.6rem 1.25rem',
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none',
  borderRadius: theme.radius.md,
  fontSize: '0.9375rem',
  cursor: 'pointer',
  flexShrink: 0,
  '&:hover': { background: theme.colors.action.primary.backgroundHover },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
})

const inlineFormCenterAlignStyle = css({ alignItems: 'center' })
const inlineFormEndAlignStyle = css({ alignItems: 'flex-end' })

const composerWrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  gap: '0.25rem',
})

const metaRowStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '0.6875rem',
  color: theme.colors.text.muted,
  padding: '0 0.125rem',
})

// Stacked composer (customer chat): label, textarea, counter + submit, hint.
const stackedFormStyle = css({
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: '1rem',
})

const stackedLabelStyle = css({
  display: 'block',
  fontSize: '1rem',
  fontWeight: 600,
  marginBottom: '0.5rem',
  color: theme.colors.text.primary,
})

const stackedTextareaStyle = css({
  width: '100%',
  minHeight: '50px',
  padding: '0.75rem',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  fontFamily: 'inherit',
  fontSize: '1rem',
  color: theme.colors.text.primary,
  background: theme.surface.lvl1,
  resize: 'vertical',
  outline: 'none',
  boxSizing: 'border-box',
})

const stackedActionsStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '0.75rem',
  marginTop: '0.75rem',
})

const counterStyle = css({
  fontSize: '0.75rem',
  color: theme.colors.text.muted,
  fontVariantNumeric: 'tabular-nums',
})

const stackedHintStyle = css({
  marginTop: '0.5rem',
  fontSize: '0.75rem',
  color: theme.colors.text.muted,
})

const stackedButtonStyle = css({
  padding: '0.6rem 1.5rem',
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none',
  borderRadius: theme.radius.md,
  fontSize: '1rem',
  cursor: 'pointer',
})

export type ChatComposerTextarea = {
  name?: string
  rows?: number
  placeholder?: string
  required?: boolean
  maxLength?: number
  ariaLabel?: string
  ariaDescribedBy?: string
  autoComplete?: string
}

export type ChatComposerProps = {
  /** `inline` = admin textarea + button row; `stacked` = customer label/textarea/actions. */
  variant?: 'inline' | 'stacked'
  formId: string
  formAction?: string
  formMethod?: 'POST' | 'get'
  formAutoComplete?: string
  textareaId: string
  textarea: ChatComposerTextarea
  submitId: string
  submitLabel: string
  /** Cross-axis alignment of the inline row (default `center`). */
  align?: 'center' | 'flex-end'
  /** Optional counter, rendered as `<span id=...>` next to the submit button. */
  counter?: { id: string; initial: string }
  /** Optional meta content rendered opposite the counter (inline variant). */
  meta?: RemixNode
  /** Optional hint rendered below the controls (stacked variant). */
  hint?: RemixNode
  /** Optional label rendered above the textarea (stacked variant). */
  label?: { htmlFor: string; text: RemixNode }
  /** Wrap textarea (+ counter/meta) in a column so the button sits beside it. */
  wrapTextarea?: boolean
}

/**
 * Shared agent-chat composer. The element ids are props because each stream
 * queries them from the server-rendered DOM, so the shared component must emit
 * the agent-specific contract unchanged.
 */
export function ChatComposer(handle: Handle<ChatComposerProps>) {
  return () => {
    let {
      variant = 'inline',
      formId,
      formAction,
      formMethod,
      formAutoComplete,
      textareaId,
      textarea,
      submitId,
      submitLabel,
      align = 'center',
      counter,
      meta,
      hint,
      label,
      wrapTextarea,
    } = handle.props

    // Render the column wrapper whenever there is anything to put under the
    // textarea; otherwise a caller that passes counter/meta without
    // `wrapTextarea` would silently lose them.
    let hasMetaRow = wrapTextarea === true || counter != null || meta != null

    let field = (
      <textarea
        id={textareaId}
        name={textarea.name ?? 'message'}
        rows={textarea.rows ?? 3}
        placeholder={textarea.placeholder}
        required={textarea.required}
        maxLength={textarea.maxLength}
        autoComplete={textarea.autoComplete}
        aria-label={textarea.ariaLabel}
        aria-describedby={textarea.ariaDescribedBy}
        mix={variant === 'stacked' ? stackedTextareaStyle : inlineTextareaStyle}
      />
    )

    if (variant === 'stacked') {
      return (
        <form
          id={formId}
          method={formMethod ?? 'POST'}
          action={formAction}
          autoComplete={formAutoComplete}
          mix={stackedFormStyle}
        >
          {label ? (
            <label htmlFor={label.htmlFor} mix={stackedLabelStyle}>
              {label.text}
            </label>
          ) : null}
          {field}
          <div mix={stackedActionsStyle}>
            {counter ? (
              <span id={counter.id} mix={counterStyle}>
                {counter.initial}
              </span>
            ) : (
              <span />
            )}
            <button id={submitId} type="submit" mix={stackedButtonStyle}>
              {submitLabel}
            </button>
          </div>
          {hint ? <p mix={stackedHintStyle}>{hint}</p> : null}
        </form>
      )
    }

    return (
      <form
        id={formId}
        method={formMethod}
        action={formAction}
        autoComplete={formAutoComplete}
        mix={[
          inlineFormStyle,
          align === 'flex-end' ? inlineFormEndAlignStyle : inlineFormCenterAlignStyle,
        ]}
      >
        {hasMetaRow ? (
          <div mix={composerWrapStyle}>
            {field}
            <div mix={metaRowStyle}>
              {counter ? <span id={counter.id}>{counter.initial}</span> : <span />}
              <span>{meta}</span>
            </div>
          </div>
        ) : (
          field
        )}
        <button id={submitId} type="submit" mix={inlineButtonStyle}>
          {submitLabel}
        </button>
      </form>
    )
  }
}
