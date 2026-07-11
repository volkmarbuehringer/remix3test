import type { Cookie } from 'remix/cookie'
import { createRouter } from 'remix/router'
import type { SessionStorage } from 'remix/session'

import controller from './actions/home/controller.tsx'
import listsController from './actions/lists/controller.tsx'
import apiListsController from './actions/api/lists/controller.tsx'
import {
  authLogin,
  authRegister,
  registerSent,
  verify,
  authForgotten,
  authForgottenReset,
  authLogout,
} from './actions/auth/controller.tsx'
import { mastraChat } from './actions/mastra/controller.tsx'
import { customerChat } from './actions/chat/controller.tsx'
import { testAgent } from './actions/test-agent/controller.tsx'
import clientController from './actions/client/controller.tsx'
import {
  adminController,
  adminChatlog,
  adminChatlogFragments,
  adminMessages,
  adminFragments,
  adminLists,
  adminUsers,
} from './actions/admin/controller.tsx'
import adminNutzerController from './actions/nutzer/controller.tsx'
import verwaltungController from './actions/verwaltung/controller.tsx'
import verwaltungOfferings from './actions/verwaltung/offerings/controller.tsx'
import verwaltungAppointments from './actions/verwaltung/appointments/controller.tsx'
import verwaltungResources from './actions/verwaltung/resources/controller.tsx'
import verwaltungOfferingConfigs from './actions/verwaltung/offering-configs/controller.tsx'
import verwaltungReport1 from './actions/verwaltung/report1/controller.tsx'
import verwaltungPdf from './actions/verwaltung/pdf/controller.tsx'
import verwaltungUsersPdf from './actions/verwaltung/users-pdf/controller.tsx'
import verwaltungUsersExport from './actions/verwaltung/users-export/controller.tsx'
import { appointment, appointmentTypes } from './actions/appointment/controller.tsx'
import appointmentsNewController from './actions/appointments-new/controller.tsx'
import settingsController from './actions/settings/controller.tsx'
import uploadsController, {
  download as uploadsDownloadHandler,
} from './actions/uploads/controller.tsx'
import { webhookReceive } from './actions/webhook/controller.tsx'
import { apiLogin } from './actions/api/login/controller.tsx'
import { apiLogout } from './actions/api/logout/controller.tsx'
import { appWebhookReceive } from './actions/app-webhook/controller.tsx'
import {
  webhookRequestsIndex,
  webhookRequestsEvents,
  webhookRequestsResend,
  webhookRequestsUpdate,
} from './actions/webhook-requests/controller.tsx'
import { webhookRequestsCreate } from './actions/webhook-requests/create/controller.tsx'
import { callbackReceive } from './actions/callback/controller.tsx'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import {
  routes,
  uploadsDownload,
  webhookRoute,
  webhookRequestsRoute,
  webhookRequestsEventsRoute,
  webhookRequestsResendRoute,
  webhookRequestsUpdateRoute,
  webhookCreateRoute,
  appWebhookRoute,
  callbackRoute,
} from './routes.ts'
import { createNewappMiddleware } from './middleware/root.ts'
import type { AppContext } from './types/context.ts'

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

export interface NewappRouterOptions {
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
  router.map(routes.admin.client, clientController)

  // Nutzer route (under admin, admin-only middleware in controller)
  router.map(routes.admin.nutzer, adminNutzerController)

  // Lists routes (separate controller with requireAuth middleware)
  router.map(routes.lists, listsController)

  // API auth routes
  router.post(routes.api.login, apiLogin)
  router.post(routes.api.logout, apiLogout)

  // API Lists routes (per-user token auth)
  router.map(routes.apiLists, apiListsController)

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

  // Webhook routes
  router.post(webhookRoute, webhookReceive)
  router.post(appWebhookRoute, appWebhookReceive)
  router.post(callbackRoute, callbackReceive)
  router.get(webhookRequestsRoute, webhookRequestsIndex)
  router.get(webhookRequestsEventsRoute, webhookRequestsEvents)
  router.post(webhookRequestsResendRoute, webhookRequestsResend)
  router.put(webhookRequestsUpdateRoute, webhookRequestsUpdate)
  router.map(webhookCreateRoute, webhookRequestsCreate)

  // Uploads routes
  router.map(routes.uploads, uploadsController)
  router.get(uploadsDownload, uploadsDownloadHandler)

  // Appointment routes (separate controller with requireAuth middleware)
  router.map(routes.appointment, appointment)
  router.map(routes.appointment.types, appointmentTypes)
  router.map(routes.appointmentsNew, appointmentsNewController)

  // Mastra Chat route (single AI entry point)
  router.map(routes.mastra.chat, mastraChat)

  // Customer Chat route (resource matching)
  router.map(routes.chat, customerChat)

  // Test Agent route (auth-gated, SSE streaming)
  router.map(routes.testAgent, testAgent)

  // Admin routes
  router.map(routes.admin, adminController)
  router.map(routes.admin.chatlog, adminChatlog)
  router.map(routes.admin.messages, adminMessages)
  router.map(routes.admin.fragments, adminFragments)
  router.map(routes.admin.chatlog.fragments, adminChatlogFragments)
  router.map(routes.admin.lists, adminLists)
  router.map(routes.admin.users, adminUsers)

  // Verwaltung routes
  router.map(routes.verwaltung, verwaltungController)
  router.map(routes.verwaltung.offerings, verwaltungOfferings)
  router.map(routes.verwaltung.appointments, verwaltungAppointments)
  router.map(routes.verwaltung.resources, verwaltungResources)
  router.map(routes.verwaltung.offeringConfigs, verwaltungOfferingConfigs)
  router.map(routes.verwaltung.report1, verwaltungReport1)
  router.map(routes.verwaltung.pdf, verwaltungPdf)
  router.map(routes.verwaltung.usersPdf, verwaltungUsersPdf)
  router.map(routes.verwaltung.usersExport, verwaltungUsersExport)

  return router
}

// NOTE: Test consumers that need a shared router instance should import
// from app/test-router.ts, not from this module. This keeps the production
// composition root free of singleton side-effects while letting tests
// share one middleware stack built once at module-eval time.
