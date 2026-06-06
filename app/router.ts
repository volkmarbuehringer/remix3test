import type { Cookie } from 'remix/cookie'
import { createRouter } from 'remix/router'
import type { SessionStorage } from 'remix/session'

import controller from './actions/home/controller.tsx'
import listsController from './actions/lists/controller.tsx'
import loginController from './actions/auth-login/controller.tsx'
import registerController, { registerSent } from './actions/auth-register/controller.tsx'
import { verify } from './actions/auth-verify/controller.tsx'
import forgottenController, { forgottenReset } from './actions/auth-forgotten/controller.tsx'
import chatController from './actions/chat/controller.tsx'
import agentController from './actions/agent/controller.tsx'
import aiController from './actions/ai/controller.tsx'
import aiFragmentsController from './actions/ai-fragments/controller.tsx'
import workflowController from './actions/workflow/controller.tsx'
import clientController from './actions/client/controller.tsx'
import adminController from './actions/admin/controller.tsx'
import adminChatlogController from './actions/admin-chatlog/controller.tsx'
import adminChatlogFragmentsController from './actions/admin-chatlog-fragments/controller.tsx'
import adminMessagesController from './actions/admin-messages/controller.tsx'
import adminFragmentsController from './actions/admin-fragments/controller.tsx'
import adminListsController from './actions/admin-lists/controller.tsx'
import adminNutzerController from './actions/nutzer/controller.tsx'
import adminOfferingsController from './actions/admin-offerings/controller.tsx'
import adminAppointmentsController from './actions/admin-appointments/controller.tsx'
import adminUsersController from './actions/admin-users/controller.tsx'
import adminResourcesController from './actions/admin-resources/controller.tsx'
import adminOfferingConfigsController from './actions/admin-offering-configs/controller.tsx'
import verwaltungController from './actions/verwaltung/controller.tsx'
import appointmentController from './actions/appointment/controller.tsx'
import appointmentsNewController from './actions/appointments-new/controller.tsx'
import appointTypeController from './actions/appointtype/controller.tsx'
import settingsController from './actions/settings/controller.tsx'
import { authLogout } from './actions/auth-logout/controller.tsx'
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
  router.map(routes.auth.login, loginController)
  router.map(routes.auth.register, registerController)
  router.get(routes.auth.registerSent.href(), registerSent)
  router.get(routes.auth.verify.href({ token: ':token' }), verify)
  router.post(routes.auth.logout.href(), authLogout)
  router.map(routes.auth.forgotten, forgottenController)
  router.map(routes.auth.forgottenReset, forgottenReset)

  // Settings routes
  router.map(routes.settings, settingsController)

  // Appointment routes (separate controller with requireAuth middleware)
  router.map(routes.appointment, appointmentController)
  router.map(routes.appointment.types, appointTypeController)
  router.map(routes.appointmentsNew, appointmentsNewController)

  // AI routes
  router.map(routes.ai, aiController)
  router.map(routes.ai.chat, chatController)
  router.map(routes.ai.agent, agentController)
  router.map(routes.ai.workflow, workflowController)
  router.map(routes.ai.fragments, aiFragmentsController)

  // Admin routes
  router.map(routes.admin, adminController)
  router.map(routes.admin.chatlog, adminChatlogController)
  router.map(routes.admin.messages, adminMessagesController)
  router.map(routes.admin.fragments, adminFragmentsController)
  router.map(routes.admin.chatlog.fragments, adminChatlogFragmentsController)
  router.map(routes.admin.lists, adminListsController)
  router.map(routes.admin.users, adminUsersController)

  // Verwaltung routes
  router.map(routes.verwaltung, verwaltungController)
  router.map(routes.verwaltung.offerings, adminOfferingsController)
  router.map(routes.verwaltung.appointments, adminAppointmentsController)
  router.map(routes.verwaltung.resources, adminResourcesController)
  router.map(routes.verwaltung.offeringConfigs, adminOfferingConfigsController)

  return router
}

// Default instance for backward compatibility
export const router = createNewappRouter()
