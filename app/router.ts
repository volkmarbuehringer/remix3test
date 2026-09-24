import type { Cookie } from 'remix/cookie'
import { createRouter } from 'remix/router'
import type { SessionStorage } from 'remix/session'

import controller from './actions/home/controller.tsx'
import listsController from './actions/lists/controller.tsx'
import * as api from './actions/api/controller.tsx'
import {
  authLogin,
  authRegister,
  registerSent,
  verify,
  authForgotten,
  authForgottenReset,
  authLogout,
} from './actions/auth/controller.tsx'
import { customerChat } from './actions/chat/controller.tsx'
import * as admin from './actions/admin/controller.tsx'
import * as verwaltung from './actions/verwaltung/controller.tsx'
import { appointment, appointmentTypes } from './actions/appointment/controller.tsx'
import appointmentsNewController from './actions/appointments-new/controller.tsx'
import settingsController from './actions/settings/controller.tsx'
import notificationsController from './actions/notifications/controller.tsx'
import scrollRestorationController from './actions/scroll-restoration/controller.tsx'
import legalController from './actions/legal/controller.tsx'
import webhookReceive from './actions/webhook/controller.tsx'
import appWebhookReceive from './actions/app-webhook/controller.tsx'
import {
  webhookRequestsLegacy,
  webhookRequestsLegacyRoot,
} from './actions/admin/webhook-requests/controller.tsx'
import callbackReceive from './actions/callback/controller.tsx'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { legal, routes, system } from './routes.ts'
import { createNewappMiddleware } from './middleware/root.ts'
import type { AppContext } from './types/context.ts'

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

interface NewappRouterOptions {
  sessionCookie?: Cookie
  sessionStorage?: SessionStorage
}

export function createNewappRouter(options?: NewappRouterOptions) {
  let cookie = options?.sessionCookie ?? sessionCookie
  let storage = options?.sessionStorage ?? sessionStorage

  let router = createRouter({ middleware: createNewappMiddleware(cookie, storage) })

  // Main app routes
  router.map(routes, controller)

  // Client Lab route
  router.map(routes.admin.clients, admin.adminClients)

  // Lists routes (separate controller with requireAuth middleware)
  router.map(routes.lists, listsController)

  // API auth routes
  router.post(routes.api.login, api.apiLogin)
  router.post(routes.api.logout, api.apiLogout)

  // API Lists routes (per-user token auth)
  router.map(routes.apiLists, api.apiLists)

  // Auth routes
  router.map(routes.auth.login, authLogin)
  router.map(routes.auth.register, authRegister)
  router.get(routes.auth.registerSent, registerSent)
  router.get(routes.auth.verify, verify)
  router.post(routes.auth.logout, authLogout)
  router.map(routes.auth.forgotten, authForgotten)
  router.map(routes.auth.forgottenReset, authForgottenReset)

  // Settings routes
  router.map(routes.settings, settingsController)

  // Notifications routes (in-app booking notification inbox, user-facing)
  router.map(routes.notifications, notificationsController)

  // Frame traversal scroll-restoration reproduction (public, no auth)
  router.map(routes.scrollRestoration, scrollRestorationController)

  // Legal pages (public, no auth)
  router.map(legal, legalController)

  // Webhook routes
  router.post(system.webhook, webhookReceive)
  router.post(system.appWebhook, appWebhookReceive)
  router.post(system.callback, callbackReceive)
  // Legacy top-level viewer URLs. The viewer now lives under /admin; redirect
  // the old paths (bookmarks, stale SSE tabs) instead of 404ing.
  router.get(system.webhookRequestsLegacyRoot, webhookRequestsLegacyRoot)
  router.get(system.webhookRequestsLegacy, webhookRequestsLegacy)

  // Uploads routes
  router.map(routes.admin.uploads, admin.adminUploads)

  // Webhook-requests viewer (admin-only). Start with the static child routes so
  // the SSE (events) and composer (create) paths are matched before the parent
  // group's dynamic GET /:id resolver.
  router.map(routes.admin.webhookRequests.events, admin.adminWebhookRequestsEvents)
  router.map(routes.admin.webhookRequests.create, admin.adminWebhookRequestsCreate)
  router.map(routes.admin.webhookRequests, admin.adminWebhookRequests)

  // Appointment routes (separate controller with requireAuth middleware)
  router.map(routes.appointment, appointment)
  router.map(routes.appointment.types, appointmentTypes)
  router.map(routes.appointmentsNew, appointmentsNewController)

  // Customer Chat route (resource matching)
  router.map(routes.chat, customerChat)

  // Admin routes
  router.map(routes.admin, admin.adminController)
  router.map(routes.admin.chatlog, admin.adminChatlog)
  router.map(routes.admin.messages, admin.adminMessages)
  router.map(routes.admin.fragments, admin.adminFragments)
  router.map(routes.admin.chatlog.fragments, admin.adminChatlogFragments)
  router.map(routes.admin.lists, admin.adminLists)
  router.map(routes.admin.users, admin.adminUsers)

  // Agent Events (experimental event pipeline, admin-only)
  router.map(routes.admin.agentEvents, admin.agentEvents)

  // Support-Agent chat (admin-only, SSE streaming)
  router.map(routes.admin.supportAgent, admin.supportAgent)

  // Verwaltung routes
  router.map(routes.verwaltung, verwaltung.controller)
  router.map(routes.verwaltung.offerings, verwaltung.offerings)
  router.map(routes.verwaltung.appointments, verwaltung.appointments)
  router.map(routes.verwaltung.resources, verwaltung.resources)
  router.map(routes.verwaltung.offeringConfigs, verwaltung.offeringConfigs)
  router.map(routes.verwaltung.report1, verwaltung.report1)
  router.map(routes.verwaltung.pdf, verwaltung.pdf)
  router.map(routes.verwaltung.usersPdf, verwaltung.usersPdf)
  router.map(routes.verwaltung.usersExport, verwaltung.usersExport)

  return router
}

// NOTE: Test consumers that need a shared router instance should import
// from app/test-router.ts, not from this module. This keeps the production
// composition root free of singleton side-effects while letting tests
// share one middleware stack built once at module-eval time.
