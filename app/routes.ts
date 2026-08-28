import { del, get, post, put, route, form, resources } from 'remix/routes'

export const frames = {
  adminContent: 'admin-content',
  listsContent: 'lists-content',

  appointmentContent: 'appointment-content',
  appointTypes: 'appoint-types',

  workflowAgentPanel: 'workflow-agent-panel',
  agentEventsPanel: 'agent-events-panel',
  supportAgentPanel: 'support-agent-panel',
} as const

export const routes = route({
  assets: get('/assets/*path'),
  home: get('/'),

  api: route('api', {
    login: post('/login'),
    logout: post('/logout'),
  }),

  apiLists: route('api/lists', {
    index: get('/'),
    show: get('/:id'),
    create: post('/'),
    update: put('/:id'),
    destroy: del('/:id'),
  }),

  lists: route('lists', {
    index: get('/'),
    create: post('/'),
    update: put('/:id'),
    move: post('/:id/move'),
    destroy: post('/:id/delete'),
  }),

  auth: route('auth', {
    login: form('login'),
    register: form('register'),
    registerSent: get('/register-sent'),
    logout: post('logout'),
    verify: get('/verify/:token'),
    forgotten: form('forgotten'),
    forgottenReset: form('forgotten/:token'),
  }),

  settings: form('settings'),
  chat: route('chat', {
    index: get('/'),
    action: post('/'),
    stream: get('/stream/:runId'),
    approve: post('/approve'),
    decline: post('/decline'),
    answer: post('/answer'),
  }),

  appointment: route('appointment', {
    index: get('/'),
    create: post('/'),
    update: put('/:id'),
    destroy: del('/:id'),
    events: get('/events'),
    types: resources('types', { exclude: ['new', 'show', 'edit'] }),
  }),

  appointmentsNew: route('appointments/new', {
    index: get('/'),
    create: post('/'),
    destroy: del('/:id'),
    events: get('/events'),
  }),

  admin: route('admin', {
    index: get('/'),

    clients: route('clients', {
      index: get('/'),
      edit: get('/edit/:rowId'),
      create: post('/'),
      update: put('/:id'),
      destroy: del('/:id'),
      toggleStatus: post('/:id/toggle-status'),
    }),

    chatlog: route('chatlog', {
      index: get('/'),
      destroy: post('/:id/delete'),

      fragments: route('fragments', {
        detail: get('/detail/:id'),
      }),
    }),

    messages: route('messages', {
      index: get('/'),
      action: post('/'),
      destroy: post('/:id/delete'),
      subscribe: get('/subscribe'),
    }),

    lists: route('lists', {
      index: get('/'),
      create: post('/'),
      update: put('/:id'),
      destroy: del('/:id'),
    }),

    users: route('users', {
      index: get('/'),
      create: post('/'),
      update: put('/:id'),
      destroy: del('/:id'),
      toggleDisabled: post('/:id/toggle-disabled'),
    }),

    uploads: route('uploads', {
      index: get('/'),
      action: post('/'),
      download: get('/:id/download'),
    }),

    fragments: route('fragments', {
      stats: get('/stats'),
      recentActivity: get('/recent-activity'),
      userDetail: get('/user-detail/:userId'),
    }),

    workflowAgent: route('workflow-agent', {
      index: get('/'),
      panel: get('/panel'),
      action: post('/'),
      resume: post('/resume'),
      stream: get('/stream'),
    }),

    agentEvents: route('agent-events', {
      index: get('/'),
      panel: get('/panel'),
      action: post('/'),
      resume: post('/resume'),
      reconnect: get('/reconnect'),
    }),

    supportAgent: route('support-agent', {
      index: get('/'),
      panel: get('/panel'),
      action: post('/'),
      toolDecision: post('/tool-decision'),
      answer: post('/answer'),
    }),
  }),

  verwaltung: route('verwaltung', {
    index: get('/'),

    offerings: route('offerings', {
      index: get('/'),
      create: post('/'),
      update: put('/:id'),
      destroy: del('/:id'),
      configSave: post('/config'),
      weekGenerate: post('/week'),
      deletePast: post('/delete-past'),
    }),

    appointments: route('appointments', {
      index: get('/'),
      // Raw /:id renders the edit panel — the frame commits this path as its
      // address after a PUT/DELETE, so it must be a valid GET (see README:
      // form action == frame src). Mirrors ?editing=<id>.
      show: get('/:id'),
      create: post('/'),
      update: put('/:id'),
      destroy: del('/:id'),
      events: get('/events'),
    }),

    resources: resources('resources', { exclude: ['new', 'edit'] }),

    offeringConfigs: resources('offering-configs', {
      exclude: ['new', 'edit'],
    }),

    report1: route('report1', {
      index: get('/'),
    }),

    pdf: route('pdf', {
      index: get('/'),
    }),

    usersPdf: route('users-pdf', {
      index: get('/'),
    }),

    usersExport: route('users-export', {
      index: get('/'),
      create: post('/'),
    }),
  }),

  // Frame traversal scroll-restoration reproduction (see
  // app/actions/scroll-restoration/). Mirrors the upstream demo so we can
  // assert that the browser Back button restores scroll when a top-level
  // client entry reconciliation shrinks the document.
  scrollRestoration: route('scroll-restoration', {
    index: get('/'),
    detail: get('/detail'),
    items: get('/frames/scroll-restoration-items'),
  }),
})

export const system = {
  webhook: post('/webhook'),
  appWebhook: post('/app-webhook'),
  callback: post('/callback'),
  webhookRequests: get('/webhook-requests'),
  webhookRequestEvents: get('/webhook-requests/events'),
  webhookRequestResend: post('/webhook-requests/:id/resend'),
  webhookRequestUpdate: put('/webhook-requests/:id'),
  webhookRequestCreate: form('/webhook-requests/create'),
} as const
