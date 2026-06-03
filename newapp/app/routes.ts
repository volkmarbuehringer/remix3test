import { del, get, post, put, route, form, resources } from 'remix/routes'

export const frames = {
  adminContent: 'admin-content',
  aiContent: 'ai-content',
  clientGrid: 'client-grid',
  appointmentContent: 'appointment-content',
  appointTypes: 'appoint-types',
} as const

// Main app routes
export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  ui: get('/ui'),
  uiComponent: get('/ui/:component'),

  // Client Lab route (Frame-based grid with CRUD)
  client: route('client', {
    index: get('/'),
    grid: get('/grid'),
    edit: get('/edit/:rowId'),
    create: post('/'),
    update: put('/:id'),
    destroy: del('/:id'),
  }),

  // Nutzer (user management) — top-level route, admin-only middleware in controller
  nutzer: route('nutzer', {
    index: get('/'),
    create: post('/'),
    update: put('/:id'),
    destroy: del('/:id'),
    resetPassword: post('/:id/reset-password'),
    toggleLock: post('/:id/toggle-lock'),
    toggleActive: post('/:id/toggle-active'),
  }),
})

// Lists routes (separate controller with requireAuth middleware)
export const listsRoutes = route({
  lists: get('/lists'),
  listsSave: post('/lists/save'),
  listsUpdate: put('/lists/:id/update'),
  listsShow: get('/lists/:id'),
  listsData: get('/lists/:id/data'),
})

// Appointment routes (separate controller with requireAuth middleware)
export const appointmentRoutes = route({
  appointment: route('appointment', {
    index: get('/'),
    create: post('/'),
    update: put('/:id'),
    destroy: del('/:id'),
    events: get('/events'),

    types: resources('types', { exclude: ['new', 'show', 'edit'] }),
  }),
})

// Auth routes (separate tree, handled by their own controllers)
export const authRoutes = route({
  authLogin: form('login'),
  authRegister: form('register'),
  authLogout: post('logout'),
})

// Admin routes (separate tree, handled by their own controllers with admin middleware)
export const adminRoutes = route({
  admin: route('admin', {
    index: get('/'),

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

    // Admin users CRUD
    users: resources('users', { exclude: ['new', 'show', 'edit'] }),

    // Fragment routes for nested frame content
    fragments: route('fragments', {
      stats: get('/stats'),
      recentActivity: get('/recent-activity'),
      userDetail: get('/user-detail/:userId'),
    }),
  }),
})

// Verwaltung routes — operational data management (no sidebar layout)
export const verwaltungRoutes = route({
  verwaltung: route('verwaltung', {
    index: get('/'),

    offerings: route('offerings', {
      index: get('/'),
      create: post('/'),
      update: put('/:id'),
      destroy: del('/:id'),
      configSave: post('/config'),
      weekGenerate: post('/week'),
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
  }),
})

// AI routes (under /ai/ prefix with dashboard, frame-based navigation)
export const aiRoutes = route({
  ai: route('ai', {
    index: get('/'),
    chat: form('chat'),
    agent: form('agent'),
    workflow: form('workflow'),

    // Fragment routes for frame-based content
    fragments: route('fragments', {
      agentResult: get('/agent-result'),
    }),
  }),
})
