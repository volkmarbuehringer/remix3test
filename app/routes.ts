import { del, get, post, put, route, form, resources } from 'remix/routes'

export const frames = {
  adminContent: 'admin-content',
  listsContent: 'lists-content',

  appointmentContent: 'appointment-content',
  appointTypes: 'appoint-types',

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
    copy: post('/:id/copy'),
    merge: post('/:id/merge'),
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

  notifications: route('notifications', {
    index: get('/'),
    events: get('/events'),
    unreadCount: get('/unread-count'),
    markRead: post('/:id/read'),
    markAllRead: post('/mark-all-read'),
  }),

  chat: route('chat', {
    index: get('/'),
    action: post('/'),
    approve: post('/approve'),
    decline: post('/decline'),
    answer: post('/answer'),
    reconnect: get('/reconnect'),
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
      // Frame action-path resolver: the frame commits the POST delete form
      // action as its src after submission, so that path must also resolve as
      // a GET to avoid a 404 on reload.
      destroyResolve: get('/:id/delete'),

      fragments: route('fragments', {
        detail: get('/detail/:id'),
      }),
    }),

    messages: route('messages', {
      index: get('/'),
      action: post('/'),
      destroy: post('/:id/delete'),
      // The frame commits the POST form action path as its address after a
      // submission, and the live ConnectionIndicator reloads it on invalidate.
      // The action path must therefore also resolve as a GET (form action ==
      // frame src); this resolver renders the messages list.
      destroyResolve: get('/:id/delete'),
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
      // The frame commits the POST toggle action path as its src after a
      // submission, and a later reload (e.g. the agent-events workflow-finish
      // reload) GETs that path. Render the users grid so a stale GET resolves
      // instead of a 405 (see admin chatlog/messages destroyResolve).
      toggleDisabledResolve: get('/:id/toggle-disabled'),
    }),

    uploads: route('uploads', {
      index: get('/'),
      action: post('/'),
      download: get('/:id/download'),
      destroy: post('/:id/delete'),
      // The frame commits the POST delete form action path (form action ==
      // frame src) as its address after submission, and the live
      // ConnectionIndicator reloads it on invalidate. Render the list so that a
      // GET of the action path resolves instead of falling to a 404 on the
      // POST-only delete route (see admin chatlog/messages destroyResolve).
      destroyResolve: get('/:id/delete'),
      // Multirow delete: the grid submits a single fixed POST path (not per-id)
      // for all selected rows, so it needs its own GET resolver for the same
      // frame-reload reason. `/delete-many` (one segment) cannot collide with
      // `/:id/delete` (two segments).
      destroyMany: post('/delete-many'),
      destroyManyResolve: get('/delete-many'),
      // Multirow download: the grid POSTs the selected ids and receives a ZIP
      // attachment. The form submits with `data-rmx-document`, so the frame
      // runtime does not intercept it and the action path is never committed as
      // the frame src — no GET resolver is needed.
      downloadMany: post('/download-many'),
    }),

    webhookRequests: route('webhook-requests', {
      index: get('/'),
      // Static `create`/`events` are declared before the `:id` routes so they are
      // not swallowed by the dynamic `show` segment.
      create: form('create'),
      events: route('events', { index: get('/') }),
      resend: post('/:id/resend'),
      // The frame runtime commits the POST/PUT form action path as the top
      // frame's src after an intercepted submission; any reload (including the
      // SSE ConnectionIndicator's invalidate reload racing the in-flight POST)
      // GETs that path. Both resolver paths must therefore also resolve as GETs
      // — see admin chatlog/messages destroyResolve.
      resendResolve: get('/:id/resend'),
      update: put('/:id'),
      show: get('/:id'),
    }),

    fragments: route('fragments', {
      stats: get('/stats'),
      recentActivity: get('/recent-activity'),
      userDetail: get('/user-detail/:userId'),
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
      reconnect: get('/reconnect'),
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
      // ICS calendar export of the currently filtered appointment grid. The
      // page links here with `data-rmx-document` so the browser performs a
      // native document navigation and the attachment is not swallowed by the
      // frame runtime.
      ics: get('/ics'),
    }),

    resources: resources('resources', { exclude: ['new', 'edit'] }),

    offeringConfigs: resources('offering-configs', {
      exclude: ['new', 'edit'],
    }),

    report1: route('report1', {
      index: get('/'),
      // PDF export of the currently filtered monthly evaluation. The page links
      // here with `data-rmx-document` so the browser performs a native document
      // navigation and the attachment response is not swallowed by the frame runtime.
      pdf: get('/pdf'),
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
  // Legacy viewer paths. The webhook-requests viewer moved under /admin (it is an
  // admin-only tool); keep the old top-level URLs working for bookmarks and
  // stale SSE tabs by permanently redirecting them to the new admin path.
  webhookRequestsLegacyRoot: get('/webhook-requests'),
  webhookRequestsLegacy: get('/webhook-requests/*path'),
} as const
