import type { Cookie } from 'remix/cookie'
import { createRouter } from 'remix/router'
import type { SessionStorage } from 'remix/session'

import controller from './actions/home/controller.tsx'
import listsController from './actions/lists/controller.tsx'
import { authLogin, authRegister, registerSent, verify, authForgotten, authForgottenReset, authLogout } from './actions/auth/controller.tsx'
import { default as aiController, aiChat, aiAgent, aiWorkflow, aiFragments } from './actions/ai/controller.tsx'
import clientController from './actions/client/controller.tsx'
import { adminController, adminChatlog, adminChatlogFragments, adminMessages, adminFragments, adminLists, adminUsers } from './actions/admin/controller.tsx'
import adminNutzerController from './actions/nutzer/controller.tsx'
import { default as verwaltungController, verwaltungOfferings, verwaltungAppointments, verwaltungResources, verwaltungOfferingConfigs } from './actions/verwaltung/controller.tsx'
import { appointment, appointmentTypes } from './actions/appointment/controller.tsx'
import appointmentsNewController from './actions/appointments-new/controller.tsx'
import settingsController from './actions/settings/controller.tsx'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { routes } from './routes.ts'
import { createNewappMiddleware } from './middleware/root.ts'
import type { AppContext } from './types/context.ts'

// Side-effect: registers all workflow definitions
import './workflows/definitions/index.ts'

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
  router.map(routes.client, clientController)

  // Nutzer route (top-level, admin-only middleware in controller)
  router.map(routes.nutzer, adminNutzerController)

  // Lists routes (separate controller with requireAuth middleware)
  router.map(routes.lists, listsController)

  // Auth routes
  router.map(routes.auth.login, authLogin)
  router.map(routes.auth.register, authRegister)
  router.get(routes.auth.registerSent.href(), registerSent)
  router.get(routes.auth.verify.href({ token: ':token' }), verify)
  router.post(routes.auth.logout.href(), authLogout)
  router.map(routes.auth.forgotten, authForgotten)
  router.map(routes.auth.forgottenReset, authForgottenReset)

  // Settings routes
  router.map(routes.settings, settingsController)

  // Appointment routes (separate controller with requireAuth middleware)
  router.map(routes.appointment, appointment)
  router.map(routes.appointment.types, appointmentTypes)
  router.map(routes.appointmentsNew, appointmentsNewController)

  // AI routes
  router.map(routes.ai, aiController)
  router.map(routes.ai.chat, aiChat)
  router.map(routes.ai.agent, aiAgent)
  router.map(routes.ai.workflow, aiWorkflow)
  router.map(routes.ai.fragments, aiFragments)

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

  return router
}

// Default instance for backward compatibility
export const router = createNewappRouter()
