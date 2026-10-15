import { theme } from '../theme/theme.ts'

// ── Agent cards ───────────────────────────────────────────────────────
//
// The agent surfaces render their approval/question cards imperatively inside
// `clientEntry` stream clients (they append DOM as SSE events arrive), so these
// are DOM builders rather than JSX components. Each keeps the agent-specific
// element ids/classes that its stream queries while sharing the card styling.

// ── Approval / confirmation ───────────────────────────────────────────

type CustomerApprovalCardOptions = {
  variant: 'customer'
  runId: string
  toolCallId?: string | undefined
  threadId?: string | undefined
  title: string
  description: string
}

type SupportApprovalCardOptions = {
  variant: 'support'
  /** The agent bubble the card is appended to. */
  mount: HTMLElement
  toolName?: string | undefined
  onApprove: () => void
  onDecline: () => void
}

type WorkflowConfirmGateOptions = {
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

type AgentApprovalCardOptions =
  | CustomerApprovalCardOptions
  | SupportApprovalCardOptions
  | WorkflowConfirmGateOptions

function hiddenInput(name: string, value: string): HTMLInputElement {
  let input = document.createElement('input')
  input.type = 'hidden'
  input.name = name
  input.value = value
  return input
}

function decisionButton(options: {
  decision: 'approve' | 'decline'
  label: string
  className: string
  style: string
}): HTMLButtonElement {
  let btn = document.createElement('button')
  btn.type = 'submit'
  btn.name = 'decision'
  btn.value = options.decision
  btn.className = options.className
  // A real form control so a no-JS submit reaches the same route (guide 09).
  btn.setAttribute('formaction', options.decision === 'decline' ? '/chat/decline' : '/chat/approve')
  btn.style.cssText = options.style
  btn.textContent = options.label
  return btn
}

/**
 * Builds the customer tool-approval form.
 *
 * A native `<form method="post">` (not a pair of click-handled buttons) so the
 * decision still reaches the server without JavaScript; the stream client
 * intercepts submit and upgrades it to the SSE transport. Keep the field names,
 * ids and classes in sync with `ChatApprovalForm` (the server-rendered gate).
 */
function customerApprovalCard(options: CustomerApprovalCardOptions): HTMLElement {
  let form = document.createElement('form')
  form.id = 'chat-approval'
  form.className = 'chat-decision-form'
  form.method = 'post'
  form.action = '/chat/approve'
  form.dataset.runId = options.runId
  form.style.cssText =
    `padding:1rem;border:2px solid ${theme.colors.action.danger.border};border-radius:12px;` +
    `background:${theme.surface.lvl0};align-self:flex-start;width:100%;`

  let token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
  if (token) form.appendChild(hiddenInput('_csrf', token))
  form.appendChild(hiddenInput('runId', options.runId))
  if (options.toolCallId) form.appendChild(hiddenInput('toolCallId', options.toolCallId))
  if (options.threadId) form.appendChild(hiddenInput('threadId', options.threadId))

  let title = document.createElement('div')
  title.style.cssText = `font-weight:600;font-size:1rem;margin-bottom:0.75rem;color:${theme.colors.action.danger.background}`
  title.textContent = options.title
  form.appendChild(title)

  if (options.description) {
    let description = document.createElement('div')
    description.style.cssText = `font-size:0.875rem;color:${theme.colors.text.secondary};margin-bottom:0.75rem;white-space:pre-wrap`
    description.textContent = options.description
    form.appendChild(description)
  }

  let actions = document.createElement('div')
  actions.style.cssText = 'display:flex;gap:0.75rem'
  actions.appendChild(
    decisionButton({
      decision: 'approve',
      label: '[X] Bestätigen',
      className: 'approve-btn',
      style: `padding:0.5rem 1.25rem;background:${theme.colors.action.danger.background};color:${theme.colors.action.danger.foreground};border:none;border-radius:6px;font-size:0.9rem;cursor:pointer`,
    }),
  )
  actions.appendChild(
    decisionButton({
      decision: 'decline',
      label: '[/] Ablehnen',
      className: 'decline-btn',
      style: `padding:0.5rem 1.25rem;background:${theme.surface.lvl1};color:inherit;border:1px solid ${theme.colors.border.default};border-radius:6px;font-size:0.9rem;cursor:pointer`,
    }),
  )
  form.appendChild(actions)
  return form
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

type CustomerQuestionCardOptions = {
  variant: 'customer'
  runId: string
  toolCallId?: string | undefined
  threadId?: string | undefined
  question: string
  options?: { label: string; description?: string }[] | null | undefined
  selectionMode: string
}

type SupportQuestionCardOptions = {
  variant: 'support'
  /** The agent bubble the question is appended to. */
  mount: HTMLElement
  question: string
  options?: { label: string; description?: string }[] | null | undefined
  selectionMode: string
  onAnswer: (answer: string) => void
  onError?: (error: unknown) => void
}

type AgentQuestionCardOptions = CustomerQuestionCardOptions | SupportQuestionCardOptions

/**
 * Builds the customer `ask_user` question form.
 *
 * A native `<form method="post">` (not a click-handled card) so the answer
 * still reaches the server without JavaScript; the stream client intercepts
 * submit and upgrades it to the SSE transport. Keep the field names, ids and
 * classes in sync with `ChatQuestionForm` (the server-rendered gate).
 */
function customerQuestionCard(options: CustomerQuestionCardOptions): HTMLElement {
  let form = document.createElement('form')
  form.id = 'chat-question'
  form.className = 'chat-question-form'
  form.method = 'post'
  form.action = '/chat/answer'
  form.dataset.runId = options.runId
  form.style.cssText =
    `padding:1rem;border:2px solid ${theme.colors.warning.border};border-radius:12px;` +
    `background:${theme.surface.lvl0};align-self:flex-start;width:100%;margin-top:0.5rem;`

  let token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
  if (token) form.appendChild(hiddenInput('_csrf', token))
  form.appendChild(hiddenInput('runId', options.runId))
  if (options.toolCallId) form.appendChild(hiddenInput('toolCallId', options.toolCallId))
  if (options.threadId) form.appendChild(hiddenInput('threadId', options.threadId))
  form.appendChild(hiddenInput('selectionMode', options.selectionMode))

  let title = document.createElement('div')
  title.style.cssText = `font-weight:600;font-size:1rem;margin-bottom:0.75rem;color:${theme.colors.warning.foreground}`
  title.textContent = options.question
  form.appendChild(title)

  let multi = options.selectionMode === 'multi_select'
  if (options.options && options.options.length > 0) {
    let list = document.createElement('div')
    list.id = 'q-options'
    options.options.forEach((option, index) => {
      let label = document.createElement('label')
      label.style.cssText = 'display:block;margin:4px 0;cursor:pointer'

      let input = document.createElement('input')
      input.type = multi ? 'checkbox' : 'radio'
      input.className = 'q-option'
      // A real named control so a no-JS submit carries the answer (guide 09).
      input.name = 'answer'
      input.value = option.label
      if (!multi && index === 0) input.checked = true
      label.appendChild(input)
      label.appendChild(document.createTextNode(' ' + option.label))

      if (option.description) {
        let description = document.createElement('span')
        description.style.cssText = 'opacity:0.6;font-size:0.85em'
        description.textContent = ' — ' + option.description
        label.appendChild(description)
      }
      list.appendChild(label)
    })
    form.appendChild(list)
  } else {
    let input = document.createElement('input')
    input.id = 'q-free-text'
    input.name = 'answer'
    input.type = 'text'
    input.placeholder = 'Antwort eingeben...'
    input.style.cssText = `width:100%;padding:0.5rem;border:1px solid ${theme.colors.border.default};border-radius:6px;font-size:0.9rem;box-sizing:border-box`
    form.appendChild(input)
  }

  let actions = document.createElement('div')
  actions.style.cssText = 'margin-top:0.75rem'
  let answer = document.createElement('button')
  answer.type = 'submit'
  answer.className = 'q-answer-btn'
  answer.textContent = 'Antworten'
  answer.style.cssText = `padding:0.5rem 1.25rem;background:${theme.colors.action.primary.background};color:${theme.colors.action.primary.foreground};border:none;border-radius:6px;font-size:0.9rem;cursor:pointer`
  actions.appendChild(answer)
  form.appendChild(actions)

  return form
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
