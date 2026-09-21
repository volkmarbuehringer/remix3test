import { theme } from '../theme/theme.ts'

// ── Agent cards ───────────────────────────────────────────────────────
//
// The agent surfaces render their approval/question cards imperatively inside
// `clientEntry` stream clients (they append DOM as SSE events arrive), so these
// are DOM builders rather than JSX components. Each keeps the agent-specific
// element ids/classes that its stream queries while sharing the card styling.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Approval / confirmation ───────────────────────────────────────────

export type CustomerApprovalCardOptions = {
  variant: 'customer'
  runId: string
  toolCallId?: string | undefined
  title: string
  description: string
}

export type SupportApprovalCardOptions = {
  variant: 'support'
  /** The agent bubble the card is appended to. */
  mount: HTMLElement
  toolName?: string | undefined
  onApprove: () => void
  onDecline: () => void
}

export type WorkflowConfirmGateOptions = {
  variant: 'workflow'
  /** The gate container (`#ae-confirm-gate`) to fill. */
  container: HTMLElement
  question: string
  actionType?: string | undefined
  targetUserName?: string | undefined
  pendingCount?: number | undefined
  onConfirm: () => void
  onCancel: () => void
}

export type AgentApprovalCardOptions =
  | CustomerApprovalCardOptions
  | SupportApprovalCardOptions
  | WorkflowConfirmGateOptions

/**
 * Builds the customer tool-approval card. The caller computes the title and
 * description (booking-specific); the click handling stays on the stream's
 * delegated click listener, which reads `.approve-btn` / `.decline-btn`.
 */
function customerApprovalCard(options: CustomerApprovalCardOptions): HTMLElement {
  let card = document.createElement('div')
  card.id = 'chat-approval'
  card.style.cssText =
    `padding:1rem;border:2px solid ${theme.colors.action.danger.border};border-radius:12px;` +
    `background:${theme.surface.lvl0};align-self:flex-start;width:100%;`

  let description = options.description
  card.innerHTML =
    `<div style="font-weight:600;font-size:1rem;margin-bottom:0.75rem;color:${theme.colors.action.danger.background}">${escapeHtml(options.title)}</div>` +
    (description
      ? `<div style="font-size:0.875rem;color:${theme.colors.text.secondary};margin-bottom:0.75rem;white-space:pre-wrap">${escapeHtml(description)}</div>`
      : '') +
    `<div style="display:flex;gap:0.75rem">` +
    `<button class="approve-btn" data-run-id="${escapeHtml(options.runId)}" data-tool-call-id="${escapeHtml(options.toolCallId || '')}" style="padding:0.5rem 1.25rem;background:${theme.colors.action.danger.background};color:${theme.colors.action.danger.foreground};border:none;border-radius:6px;font-size:0.9rem;cursor:pointer">[X] Bestätigen</button>` +
    `<button class="decline-btn" data-run-id="${escapeHtml(options.runId)}" data-tool-call-id="${escapeHtml(options.toolCallId || '')}" style="padding:0.5rem 1.25rem;background:${theme.surface.lvl1};color:inherit;border:1px solid ${theme.colors.border.default};border-radius:6px;font-size:0.9rem;cursor:pointer">[/] Ablehnen</button>` +
    `</div>`

  return card
}

/** Builds the support-agent tool-approval block inside an agent bubble. */
function supportApprovalCard(options: SupportApprovalCardOptions): HTMLElement {
  let { mount } = options
  let warning = document.createElement('div')
  warning.textContent = 'Tool erfordert Bestätigung: ' + (options.toolName || 'unbekannt')
  warning.style.fontWeight = '600'
  warning.style.marginBottom = '8px'
  warning.style.fontSize = '0.875rem'
  mount.appendChild(warning)

  let actions = document.createElement('div')
  actions.style.display = 'flex'
  actions.style.gap = '8px'

  let approveBtn = document.createElement('button')
  approveBtn.type = 'button'
  approveBtn.textContent = '✔ Zulassen'
  approveBtn.style.padding = '4px 14px'
  approveBtn.style.border = 'none'
  approveBtn.style.borderRadius = '4px'
  approveBtn.style.cursor = 'pointer'
  approveBtn.style.background = theme.colors.action.primary.background
  approveBtn.style.color = theme.colors.action.primary.foreground
  approveBtn.style.fontSize = '0.8125rem'
  approveBtn.onclick = () => options.onApprove()
  actions.appendChild(approveBtn)

  let declineBtn = document.createElement('button')
  declineBtn.type = 'button'
  declineBtn.textContent = '✖ Ablehnen'
  declineBtn.style.padding = '4px 14px'
  declineBtn.style.border = '1px solid ' + theme.colors.border.default
  declineBtn.style.borderRadius = '4px'
  declineBtn.style.cursor = 'pointer'
  declineBtn.style.background = theme.surface.lvl1
  declineBtn.style.color = theme.colors.text.primary
  declineBtn.style.fontSize = '0.8125rem'
  declineBtn.onclick = () => options.onDecline()
  actions.appendChild(declineBtn)

  mount.appendChild(actions)
  return mount
}

/** Fills the agent-events workflow confirmation gate. */
function workflowConfirmGate(options: WorkflowConfirmGateOptions): HTMLElement {
  let container = options.container
  container.style.display = 'flex'
  container.style.flexDirection = 'column'
  container.style.gap = '0.5rem'
  container.style.margin = '0.5rem 0.75rem'
  container.style.padding = '0.75rem'
  container.style.border = '1px solid ' + theme.colors.border.default
  container.style.borderLeft = '4px solid ' + theme.colors.action.primary.background
  container.style.borderRadius = '6px'
  container.style.background = theme.surface.lvl1
  container.innerHTML = ''

  let header = document.createElement('div')
  header.style.display = 'flex'
  header.style.alignItems = 'center'
  header.style.gap = '0.5rem'
  header.style.fontSize = '0.6875rem'
  header.style.fontWeight = '600'
  header.style.textTransform = 'uppercase'
  header.style.letterSpacing = '0.04em'
  header.style.color = theme.colors.text.muted

  let glyph = document.createElement('span')
  glyph.textContent = '⚠'
  glyph.setAttribute('aria-hidden', 'true')
  glyph.style.color = theme.colors.warning.background
  glyph.style.fontSize = '0.8125rem'
  header.appendChild(glyph)

  let label = document.createElement('span')
  label.textContent = 'Action requires confirmation'
  header.appendChild(label)
  container.appendChild(header)

  let q = document.createElement('div')
  q.textContent = options.question || 'Confirm?'
  q.style.fontWeight = '600'
  q.style.fontSize = '0.875rem'
  q.style.color = theme.colors.text.primary
  container.appendChild(q)

  let actionType = String(options.actionType || '')
  let userName = String(options.targetUserName || '')
  let pendingCount = Number(options.pendingCount || 0)
  let detailsText = actionType ? `${actionType} ${userName}`.trim() : userName
  if (pendingCount > 0) detailsText += ` — ${pendingCount} pending appointments`
  if (detailsText) {
    let details = document.createElement('div')
    details.style.fontSize = '0.75rem'
    details.style.color = theme.colors.text.muted
    details.textContent = detailsText
    container.appendChild(details)
  }

  let buttons = document.createElement('div')
  buttons.style.display = 'flex'
  buttons.style.gap = '0.5rem'

  let confirmBtn = document.createElement('button')
  confirmBtn.textContent = 'Bestätigen'
  confirmBtn.style.padding = '0.4rem 1rem'
  confirmBtn.style.border = 'none'
  confirmBtn.style.borderRadius = '4px'
  confirmBtn.style.cursor = 'pointer'
  confirmBtn.style.background = theme.colors.action.primary.background
  confirmBtn.style.color = theme.colors.action.primary.foreground
  confirmBtn.style.fontSize = '0.8125rem'
  confirmBtn.onclick = () => {
    confirmBtn.disabled = true
    cancelBtn.disabled = true
    options.onConfirm()
  }
  buttons.appendChild(confirmBtn)

  let cancelBtn = document.createElement('button')
  cancelBtn.textContent = 'Abbrechen'
  cancelBtn.style.padding = '0.4rem 1rem'
  cancelBtn.style.border = '1px solid ' + theme.colors.border.default
  cancelBtn.style.borderRadius = '4px'
  cancelBtn.style.cursor = 'pointer'
  cancelBtn.style.background = theme.surface.lvl1
  cancelBtn.style.color = theme.colors.text.primary
  cancelBtn.style.fontSize = '0.8125rem'
  cancelBtn.onclick = () => {
    confirmBtn.disabled = true
    cancelBtn.disabled = true
    options.onCancel()
  }
  buttons.appendChild(cancelBtn)

  container.appendChild(buttons)
  container.scrollIntoView({ block: 'nearest' })
  return container
}

/** Renders an agent approval / confirmation card. */
export function renderAgentApprovalCard(options: AgentApprovalCardOptions): HTMLElement {
  if (options.variant === 'customer') return customerApprovalCard(options)
  if (options.variant === 'support') return supportApprovalCard(options)
  return workflowConfirmGate(options)
}

// ── Questions ─────────────────────────────────────────────────────────

export type CustomerQuestionCardOptions = {
  variant: 'customer'
  question: string
  options?: { label: string; description?: string }[] | null | undefined
  selectionMode: string
}

export type SupportQuestionCardOptions = {
  variant: 'support'
  /** The agent bubble the question is appended to. */
  mount: HTMLElement
  question: string
  options?: { label: string; description?: string }[] | null | undefined
  selectionMode: string
  onAnswer: (answer: string) => void
  onError?: (error: unknown) => void
}

export type AgentQuestionCardOptions = CustomerQuestionCardOptions | SupportQuestionCardOptions

function customerQuestionCard(options: CustomerQuestionCardOptions): HTMLElement {
  let card = document.createElement('div')
  card.id = 'chat-question'
  card.style.cssText =
    `padding:1rem;border:2px solid ${theme.colors.warning.border};border-radius:12px;` +
    `background:${theme.surface.lvl0};align-self:flex-start;width:100%;margin-top:0.5rem;`

  let html = `<div style="font-weight:600;font-size:1rem;margin-bottom:0.75rem;color:${theme.colors.warning.foreground}">${escapeHtml(options.question)}</div>`

  if (options.options && options.options.length > 0) {
    if (options.selectionMode === 'multi_select') {
      html +=
        `<div id="q-options">` +
        options.options
          .map(
            (o) =>
              `<label style="display:block;margin:4px 0;cursor:pointer">` +
              `<input type="checkbox" class="q-option" value="${escapeHtml(o.label)}" /> ` +
              escapeHtml(o.label) +
              (o.description
                ? ` <span style="opacity:0.6;font-size:0.85em">— ${escapeHtml(o.description)}</span>`
                : '') +
              `</label>`,
          )
          .join('') +
        `</div>`
    } else {
      html +=
        `<div id="q-options">` +
        options.options
          .map(
            (o, i) =>
              `<label style="display:block;margin:4px 0;cursor:pointer">` +
              `<input type="radio" class="q-option" name="q_option" value="${escapeHtml(o.label)}" ${i === 0 ? 'checked' : ''} /> ` +
              escapeHtml(o.label) +
              (o.description
                ? ` <span style="opacity:0.6;font-size:0.85em">— ${escapeHtml(o.description)}</span>`
                : '') +
              `</label>`,
          )
          .join('') +
        `</div>`
    }
  } else {
    html += `<input id="q-free-text" type="text" style="width:100%;padding:0.5rem;border:1px solid ${theme.colors.border.default};border-radius:6px;font-size:0.9rem;box-sizing:border-box" placeholder="Antwort eingeben..." />`
  }

  html += `<div style="margin-top:0.75rem"><button type="button" class="q-answer-btn" style="padding:0.5rem 1.25rem;background:${theme.colors.action.primary.background};color:${theme.colors.action.primary.foreground};border:none;border-radius:6px;font-size:0.9rem;cursor:pointer">Antworten</button></div>`

  card.innerHTML = html
  return card
}

function supportQuestionCard(options: SupportQuestionCardOptions): HTMLElement {
  let { mount } = options
  try {
    if (!options.options || options.options.length === 0) {
      let fieldset = document.createElement('fieldset')
      fieldset.style.cssText =
        'border:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;'
      let legend = document.createElement('legend')
      legend.textContent = options.question
      legend.style.cssText = 'font-weight:600;margin-bottom:4px;font-size:0.875rem;'
      fieldset.appendChild(legend)

      let input = document.createElement('input')
      input.type = 'text'
      input.placeholder = 'Antwort...'
      input.setAttribute('aria-label', options.question)
      input.style.cssText =
        `padding:6px 10px;border:1px solid ${theme.colors.border.default};` +
        `border-radius:4px;font-size:0.8125rem;width:100%;box-sizing:border-box;` +
        `background:${theme.surface.lvl0};color:${theme.colors.text.primary};`
      fieldset.appendChild(input)

      let btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = 'Antworten'
      btn.style.cssText =
        `padding:4px 14px;border:1px solid ${theme.colors.border.default};` +
        `border-radius:4px;cursor:pointer;background:${theme.surface.lvl1};` +
        `color:${theme.colors.text.primary};font-size:0.8125rem;align-self:flex-start;`
      let submit = () => {
        let answer = input.value.trim()
        if (answer) options.onAnswer(answer)
      }
      btn.onclick = submit
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit()
      })
      fieldset.appendChild(btn)
      mount.appendChild(fieldset)
      return mount
    }

    let isMulti = options.selectionMode === 'multi_select'
    let inputType = isMulti ? 'checkbox' : 'radio'
    let MAX_OPTIONS = 50
    let optionList = options.options.slice(0, MAX_OPTIONS)

    let fieldset = document.createElement('fieldset')
    fieldset.style.cssText =
      'border:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;'
    let legend = document.createElement('legend')
    legend.textContent = options.question
    legend.style.cssText = 'font-weight:600;margin-bottom:6px;font-size:0.875rem;'
    fieldset.appendChild(legend)

    for (let opt of optionList) {
      let label = document.createElement('label')
      label.style.cssText =
        'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.8125rem;padding:2px 0;'

      let input = document.createElement('input')
      input.type = inputType
      input.name = 'q-option'
      input.value = opt.label

      let span = document.createElement('span')
      span.textContent = opt.label

      label.appendChild(input)
      label.appendChild(span)

      if (opt.description) {
        let desc = document.createElement('span')
        desc.textContent = '— ' + opt.description
        desc.style.cssText = `color:${theme.colors.text.muted};font-size:0.75rem;`
        label.appendChild(desc)
      }

      fieldset.appendChild(label)
    }

    let btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = 'Bestätigen'
    btn.style.cssText =
      `padding:4px 14px;margin-top:6px;border:1px solid ${theme.colors.border.default};` +
      `border-radius:4px;cursor:pointer;background:${theme.surface.lvl1};` +
      `color:${theme.colors.text.primary};font-size:0.8125rem;align-self:flex-start;`
    btn.onclick = () => {
      let checked = fieldset.querySelectorAll(
        'input[name="q-option"]:checked',
      ) as NodeListOf<HTMLInputElement>
      if (checked.length === 0) return

      let selected = [...checked].map((el) => el.value)
      let answer = isMulti ? JSON.stringify(selected) : selected[0]!

      mount.textContent = ''
      options.onAnswer(answer)
    }
    fieldset.appendChild(btn)
    mount.appendChild(fieldset)
    return mount
  } catch (err) {
    options.onError?.(err)
    return mount
  }
}

/** Renders an agent clarification question. */
export function renderAgentQuestionCard(options: AgentQuestionCardOptions): HTMLElement {
  if (options.variant === 'customer') return customerQuestionCard(options)
  return supportQuestionCard(options)
}
