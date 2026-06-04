import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import { maxLength, minLength } from 'remix/data-schema/checks'
import { getCsrfToken } from 'remix/middleware/csrf'
import { getCspNonce } from '../../middleware/security-headers.ts'

import { requireAuth } from '../../middleware/auth.ts'
import type { AppContext } from '../../types/context.ts'
import { routes } from '../../routes.ts'
import { fragmentResponseInit } from '../../middleware/render.tsx'
import { issuesToFieldErrors } from '../../utils/schema-utils.ts'
import {
  listAppointTypes,
  createAppointType,
  updateAppointType,
  deleteAppointType,
  AppointTypeError,
} from '../../data/appointtypes.ts'
import type { User } from '../../data/schema.ts'
import { AppointTypePanel } from '../../ui/appointtype-panel.tsx'

const createSchema = s.object({
  title: s.string().pipe(minLength(1), maxLength(80)),
})

const updateSchema = s.object({
  title: s.optional(s.string().pipe(minLength(1), maxLength(80))),
})

export default createController<typeof routes.appointment.types, AppContext>(
  routes.appointment.types,
  {
    middleware: [requireAuth()],

    actions: {
      async index(context) {
        let auth = context.auth
        if (!auth?.ok) {
          return new Response(null, { status: 401 })
        }
        let userId = (auth.identity as User).id

        let types = await listAppointTypes(context.db, userId)
        let csrfToken = getCsrfToken(context)

        let data = JSON.stringify({ types, csrfToken })

        return context.render(
          <>
            <script id="appointtype-data" type="application/json" nonce={getCspNonce()}>{data}</script>
            <AppointTypePanel csrfToken={csrfToken} />
          </>,
          fragmentResponseInit(),
        )
      },

      async create(context) {
        let auth = context.auth
        if (!auth?.ok) {
          return context.json({ error: 'Authentication required.' }, { status: 401 })
        }
        let userId = (auth.identity as User).id

        let body: unknown
        try {
          body = await context.request.json()
        } catch {
          return context.json({ error: 'Expected a valid JSON request body.' }, { status: 400 })
        }

        let parsed = s.parseSafe(createSchema, body)
        if (!parsed.success) {
          return context.json({ error: 'Validation failed.', errors: issuesToFieldErrors(parsed.issues) }, { status: 400 })
        }

        let type = await createAppointType(context.db, userId, parsed.value)
        return context.json({ type }, { status: 201 })
      },

      async update(context) {
        let auth = context.auth
        if (!auth?.ok) {
          return context.json({ error: 'Authentication required.' }, { status: 401 })
        }
        let userId = (auth.identity as User).id
        let typeId = Number(context.params.id)

        let body: unknown
        try {
          body = await context.request.json()
        } catch {
          return context.json({ error: 'Expected a valid JSON request body.' }, { status: 400 })
        }

        let parsed = s.parseSafe(updateSchema, body)
        if (!parsed.success) {
          return context.json({ error: 'Validation failed.', errors: issuesToFieldErrors(parsed.issues) }, { status: 400 })
        }

        try {
          let type = await updateAppointType(context.db, userId, typeId, parsed.value)
          return context.json({ type })
        } catch (error) {
          if (error instanceof AppointTypeError) {
            return context.json({ error: error.message }, { status: error.status })
          }
          throw error
        }
      },

      async destroy(context) {
        let auth = context.auth
        if (!auth?.ok) {
          return context.json({ error: 'Authentication required.' }, { status: 401 })
        }
        let userId = (auth.identity as User).id
        let typeId = Number(context.params.id)

        try {
          await deleteAppointType(context.db, userId, typeId)
          return context.json({ deleted: true })
        } catch (error) {
          if (error instanceof AppointTypeError) {
            return context.json({ error: error.message }, { status: error.status })
          }
          throw error
        }
      },
    },
  },
)
