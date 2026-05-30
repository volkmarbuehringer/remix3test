import type { Cookie } from 'remix/cookie'
import type { Router } from 'remix/router'
import { createRouter } from 'remix/router'
import { asyncContext } from 'remix/middleware/async-context'
import { compression } from 'remix/middleware/compression'
import { csrf } from 'remix/middleware/csrf'
import { formData } from 'remix/middleware/form-data'
import { logger } from 'remix/middleware/logger'
import { methodOverride } from 'remix/middleware/method-override'
import { session } from 'remix/middleware/session'
import type { SessionStorage } from 'remix/session'

import controller from './actions/controller.tsx'
import listsController from './actions/lists-controller.tsx'
import loginController from './actions/auth-login-controller.tsx'
import registerController from './actions/auth-register-controller.tsx'
import chatController from './actions/chat-controller.tsx'
import agentController from './actions/agent-controller.tsx'
import aiController from './actions/ai-controller.tsx'
import aiFragmentsController from './actions/ai-fragments-controller.tsx'
import workflowController from './actions/workflow-controller.tsx'
import clientController from './actions/client/controller.tsx'
import adminController from './actions/admin-controller.tsx'
import adminChatlogController from './actions/admin-chatlog-controller.tsx'
import adminChatlogFragmentsController from './actions/admin-chatlog-fragments-controller.tsx'
import adminMessagesController from './actions/admin-messages-controller.tsx'
import adminFragmentsController from './actions/admin-fragments-controller.tsx'
import adminListsController from './actions/admin-lists-controller.tsx'
import adminNutzerController from './actions/admin-nutzer-controller.tsx'
import adminOfferingsController from './actions/admin-offerings-controller.tsx'
import adminAppointmentsController from './actions/admin-appointments-controller.tsx'
import adminUsersController from './actions/admin-users-controller.tsx'
import adminResourcesController from './actions/admin-resources-controller.tsx'
import adminOfferingConfigsController from './actions/admin-offering-configs-controller.tsx'
import appointmentController from './actions/appointment-controller.tsx'
import appointTypeController from './actions/appointtype-controller.tsx'
import { authLogout } from './actions/auth-logout.tsx'
import { loadAssetEntry } from './middleware/asset-entry.ts'
import { securityHeaders } from './middleware/security-headers.ts'
import { json } from './middleware/json-render.ts'
import { render } from './middleware/render.tsx'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { loadDatabase } from './middleware/database.ts'
import { loadAuth } from './middleware/auth.ts'
import { routes, listsRoutes, authRoutes, aiRoutes, adminRoutes, appointmentRoutes } from './routes.ts'
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

export function createNewappRouter(options?: NewappRouterOptions): Router {
  let cookie = options?.sessionCookie ?? sessionCookie
  let storage = options?.sessionStorage ?? sessionStorage

  let router = createRouter<AppContext>({
    middleware: [
      logger({ format: '[%date] %method %path → %status (%duration)' }),
      securityHeaders(),
      compression(),
      formData(),
      methodOverride(),
      session(cookie, storage),
      csrf(),
      asyncContext(),
      loadDatabase(),
      loadAuth(),
      loadAssetEntry(),
      render(),
      json(),
    ],
  })

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

  // Admin nutzer route
  router.map(adminRoutes.admin.nutzer, adminNutzerController)

  // Admin offerings route
  router.map(adminRoutes.admin.offerings, adminOfferingsController)

  // Admin appointments route
  router.map(adminRoutes.admin.appointments, adminAppointmentsController)

  // Admin users route
  router.map(adminRoutes.admin.users, adminUsersController)

  // Admin resources route
  router.map(adminRoutes.admin.resources, adminResourcesController)

  // Admin offering configs route
  router.map(adminRoutes.admin.offeringConfigs, adminOfferingConfigsController)

  return router
}

// Default instance for backward compatibility
export const router = createNewappRouter()
