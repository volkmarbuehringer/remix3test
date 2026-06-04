import type { Cookie } from 'remix/cookie'
import { createRouter } from 'remix/router'
import type { SessionStorage } from 'remix/session'

import controller from './actions/home/controller.tsx'
import listsController from './actions/lists/controller.tsx'
import loginController from './actions/auth-login/controller.tsx'
import registerController from './actions/auth-register/controller.tsx'
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
import appointTypeController from './actions/appointtype/controller.tsx'
import { authLogout } from './actions/auth-logout/controller.tsx'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { routes, listsRoutes, authRoutes, aiRoutes, adminRoutes, appointmentRoutes, verwaltungRoutes } from './routes.ts'
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

  // Appointment routes (separate controller with requireAuth middleware)
  router.map(appointmentRoutes.appointment, appointmentController)

  // Appoint types routes (frame-based content, requireAuth from controller)
  router.map(appointmentRoutes.appointment.types, appointTypeController)

  // Lists routes (separate controller with requireAuth middleware)
  router.map(listsRoutes, listsController)

  // Auth routes (mapped individually to keep their own controller)
  router.map(authRoutes.authLogin, loginController)
  router.map(authRoutes.authRegister, registerController)
  router.post('/logout', authLogout)

  // AI routes (dashboard, chat, agent, workflow with their own controllers)
  router.map(aiRoutes.ai, aiController)
  router.map(aiRoutes.ai.chat, chatController)
  router.map(aiRoutes.ai.agent, agentController)
  router.map(aiRoutes.ai.workflow, workflowController)

  // AI fragment routes (frame-based content)
  router.map(aiRoutes.ai.fragments, aiFragmentsController)

  // Client Lab route
  router.map(routes.client, clientController)

  // Admin routes (with admin middleware baked into controllers)
  router.map(adminRoutes.admin, adminController)
  router.map(adminRoutes.admin.chatlog, adminChatlogController)
  router.map(adminRoutes.admin.messages, adminMessagesController)

  // Admin fragment routes (nested frame content, same auth middleware)
  router.map(adminRoutes.admin.fragments, adminFragmentsController)

  // Admin chatlog fragment routes (frame-based detail view)
  router.map(adminRoutes.admin.chatlog.fragments, adminChatlogFragmentsController)

  // Admin lists route
  router.map(adminRoutes.admin.lists, adminListsController)

  // Nutzer route (top-level, admin-only middleware in controller)
  router.map(routes.nutzer, adminNutzerController)

  // Admin users route
  router.map(adminRoutes.admin.users, adminUsersController)

  // Verwaltung routes (operational data management, no sidebar)
  router.map(verwaltungRoutes.verwaltung, verwaltungController)
  router.map(verwaltungRoutes.verwaltung.offerings, adminOfferingsController)
  router.map(verwaltungRoutes.verwaltung.appointments, adminAppointmentsController)
  router.map(verwaltungRoutes.verwaltung.resources, adminResourcesController)
  router.map(verwaltungRoutes.verwaltung.offeringConfigs, adminOfferingConfigsController)

  return router
}

// Default instance for backward compatibility
export const router = createNewappRouter()
