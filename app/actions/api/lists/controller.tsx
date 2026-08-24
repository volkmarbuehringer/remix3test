import { createController, type Middleware } from 'remix/router'
import * as s from 'remix/data-schema'
import { maxLength, minLength } from 'remix/data-schema/checks'

import { apiTokenAuth, ApiUser } from '../../../middleware/api-token-auth.ts'
import { requireApiAuth } from '../../../middleware/api-require-auth.ts'
import { createRateLimiter } from '../../../utils/rate-limiter.ts'
import { routes } from '../../../routes.ts'
import { getAllLists, getListById, createList, patchList, deleteList } from '../../../data/lists.ts'

const apiListsLimiter = createRateLimiter({ windowMs: 60_000, perUser: true, maxAttempts: 60 })

function apiListsRateLimit(): Middleware {
  return async (context, next) => {
    let userId = context.get(ApiUser)?.id
    if (userId != null && !apiListsLimiter.attempt(userId)) {
      return Response.json({ error: 'Too many requests' }, { status: 429 })
    }
    return next()
  }
}

const listItemSchema = s.object({
  id: s.string(),
  label: s.string(),
})

const listsSaveSchema = s.object({
  title: s.optional(s.string().pipe(minLength(1), maxLength(200))),
  description: s.string().pipe(minLength(1), maxLength(500)),
  items: s.array(listItemSchema),
})

export default createController(routes.apiLists, {
  middleware: [apiTokenAuth(), requireApiAuth(), apiListsRateLimit()],

  actions: {
    async index(context) {
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let limit = Math.max(1, Math.min(Number(context.url.searchParams.get('limit')) || 20, 100))
      let filter = context.url.searchParams.get('filter') || undefined

      let apiUser = context.apiUser!
      let listUserId = apiUser.role === 'admin' ? undefined : apiUser.id
      let result = await getAllLists(context.db, { offset, limit, filter }, listUserId)
      return context.json(result)
    },
    async show(context) {
      let apiUser = context.apiUser!
      let listUserId = apiUser.role === 'admin' ? undefined : apiUser.id
      let listId: number
      try {
        listId = s.parse(s.number(), Number(context.params.id))
      } catch {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      if (listId < 1) {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      let row = await getListById(context.db, listId, listUserId)
      if (!row) {
        return context.json({ error: 'List not found' }, { status: 404 })
      }

      return context.json({
        id: row.id,
        items: row.list,
        title: row.title,
        description: row.description,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })
    },
    async create(context) {
      let userId = context.apiUser!.id
      let body = context.jsonBody
      if (!body) {
        return context.json({ error: 'Invalid JSON body' }, { status: 400 })
      }

      let parseResult = s.parseSafe(listsSaveSchema, body)
      if (!parseResult.success) {
        let message =
          parseResult.issues.length > 0
            ? parseResult.issues[0].message
            : 'Description and items are required'
        return context.json({ error: message }, { status: 400 })
      }

      let { title, description, items } = parseResult.value

      if (!description.trim()) {
        return context.json({ error: 'Description is required' }, { status: 400 })
      }

      if (items.length === 0) {
        return context.json(
          { error: 'Items array is required and must not be empty' },
          { status: 400 },
        )
      }

      let row = await createList(context.db, { title, description, items }, userId)
      return context.json({ id: row.id, title: row.title, description: row.description })
    },
    async update(context) {
      let apiUser = context.apiUser!
      let listUserId = apiUser.role === 'admin' ? undefined : apiUser.id
      let listId: number
      try {
        listId = s.parse(s.number(), Number(context.params.id))
      } catch (error) {
        context.logger?.('Invalid list ID in api/lists/update: ' + String(error))
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      if (listId < 1) {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      let body = context.jsonBody
      if (!body) {
        return context.json({ error: 'Invalid JSON body' }, { status: 400 })
      }

      let updateResult = s.parseSafe(listsSaveSchema, body)
      if (!updateResult.success) {
        let message =
          updateResult.issues.length > 0
            ? updateResult.issues[0].message
            : 'Description and items are required'
        return context.json({ error: message }, { status: 400 })
      }

      let { title, description, items } = updateResult.value

      if (!description.trim()) {
        return context.json({ error: 'Description is required' }, { status: 400 })
      }

      if (items.length === 0) {
        return context.json(
          { error: 'Items array is required and must not be empty' },
          { status: 400 },
        )
      }

      let partial: {
        title?: string
        description: string
        items: Array<{ id: string; label: string }>
      } = {
        description,
        items,
      }
      if (title !== undefined) partial.title = title

      let result = await patchList(context.db, listId, partial, listUserId)
      if (!result.ok && result.reason === 'not_found') {
        return context.json({ error: 'List not found' }, { status: 404 })
      }
      if (!result.ok && result.reason === 'conflict') {
        return context.json({ error: 'List changed, retry' }, { status: 409 })
      }

      return context.json({ id: listId, title: result.row.title, description })
    },
    async destroy(context) {
      let apiUser = context.apiUser!
      let listUserId = apiUser.role === 'admin' ? undefined : apiUser.id
      let listId: number
      try {
        listId = s.parse(s.number(), Number(context.params.id))
      } catch {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      if (listId < 1) {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      let deleted = await deleteList(context.db, listId, listUserId)
      if (!deleted) {
        return context.json({ error: 'List not found' }, { status: 404 })
      }

      return context.json({ deleted: true })
    },
  },
})
