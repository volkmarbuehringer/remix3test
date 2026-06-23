import { del, get, post, put, route, form, resources } from 'remix/routes'

export const uploadsDownload = get('/uploads/:id/download')
export const webhookRoute = post('/webhook/:token')
export const webhookRequestsRoute = get('/webhook-requests')
export const webhookRequestsEventsRoute = get('/webhook-requests/events')

export const frames = {
  adminContent: 'admin-content',
  aiContent: 'ai-content',

  appointmentContent: 'appointment-content',
  appointTypes: 'appoint-types',
} as const

export const routes = route({
  assets: get('/assets/*path'),
  home: get('/'),
  ui: get('/ui'),
  uiComponent: get('/ui/:component'),

  lists: route('lists', {
    index: get('/'),
    save: post('/save'),
    update: put('/:id/update'),
    show: get('/:id'),
    data: get('/:id/data'),
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
  uploads: form('uploads'),

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

    nutzer: route('nutzer', {
      index: get('/'),
      create: post('/'),
      update: put('/:id'),
      destroy: del('/:id'),
      resetPassword: post('/:id/reset-password'),
      toggleLock: post('/:id/toggle-lock'),
      toggleActive: post('/:id/toggle-active'),
    }),

    client: route('client', {
      index: get('/'),
      edit: get('/edit/:rowId'),
      create: post('/'),
      update: put('/:id'),
      destroy: del('/:id'),
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
      destroy: post('/:id/delete'),
    }),

    users: resources('users', { exclude: ['new', 'show', 'edit'] }),

    fragments: route('fragments', {
      stats: get('/stats'),
      recentActivity: get('/recent-activity'),
      userDetail: get('/user-detail/:userId'),
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
      create: post('/'),
      update: put('/:id'),
      destroy: del('/:id'),
      events: get('/events'),
    }),

    resources: resources('resources', { exclude: ['new', 'show', 'edit'] }),

    offeringConfigs: resources('offering-configs', { exclude: ['new', 'show', 'edit'] }),

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

  ai: route('ai', {
    index: get('/'),
    chat: form('chat'),
    agent: form('agent'),
    workflow: form('workflow'),

    fragments: route('fragments', {
      agentResult: get('/agent-result'),
    }),
  }),
})
