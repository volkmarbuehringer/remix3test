import { createController, type Middleware } from 'remix/router'
import * as s from 'remix/data-schema'
import { maxLength, minLength } from 'remix/data-schema/checks'
import { Logger } from 'remix/middleware/logger'

import { JsonBody } from '../../../middleware/json-body.ts'
import { apiTokenAuth, ApiUser } from '../../../middleware/api-token-auth.ts'
import { requireApiAuth } from '../../../middleware/api-require-auth.ts'
import { createRateLimiter } from '../../../utils/rate-limiter.ts'
import { pool } from '../../../data/setup.ts'
import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../types/context.ts'
import { getAllLists, getListById, createList, updateList, deleteList } from '../../../lib/lists-api.ts'

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
  description: s.string().pipe(minLength(1), maxLength(500)),
  items: s.array(listItemSchema),
})

export default createController<typeof routes.apiLists, AppContext>(routes.apiLists, {
  middleware: [apiTokenAuth(), requireApiAuth(), apiListsRateLimit()],

  actions: {
    async index(context) {
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let limit = Math.max(1, Math.min(Number(context.url.searchParams.get('limit')) || 20, 100))
      let filter = context.url.searchParams.get('filter') || undefined

      let result = await getAllLists(context.db, pool, { offset, limit, filter })
      return context.json(result)
    },
    async show(context) {
      let listId: number
      try {
        listId = s.parse(s.number(), Number(context.params.id))
      } catch {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      if (listId < 1) {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      let row = await getListById(context.db, listId)
      if (!row) {
        return context.json({ error: 'List not found' }, { status: 404 })
      }

      return context.json({
        id: row.id,
        items: row.list,
        description: row.description,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })
    },
    async create(context) {
      let body = context.get(JsonBody)
      if (!body) {
        return context.json({ error: 'Invalid JSON body' }, { status: 400 })
      }

      let parseResult = s.parseSafe(listsSaveSchema, body)
      if (!parseResult.success) {
        let message = parseResult.issues.length > 0 ? parseResult.issues[0].message : 'Description and items are required'
        return context.json({ error: message }, { status: 400 })
      }

      let { description, items } = parseResult.value

      if (!description.trim()) {
        return context.json({ error: 'Description is required' }, { status: 400 })
      }

      if (items.length === 0) {
        return context.json({ error: 'Items array is required and must not be empty' }, { status: 400 })
      }

      let row = await createList(context.db, { description, items })
      return context.json({ id: row.id, description: row.description })
    },
    async update(context) {
      let listId: number
      try {
        listId = s.parse(s.number(), Number(context.params.id))
      } catch (error) {
        context.get(Logger)?.('Invalid list ID in api/lists/update: ' + String(error))
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      if (listId < 1) {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      let body = context.get(JsonBody)
      if (!body) {
        return context.json({ error: 'Invalid JSON body' }, { status: 400 })
      }

      let updateResult = s.parseSafe(listsSaveSchema, body)
      if (!updateResult.success) {
        let message = updateResult.issues.length > 0 ? updateResult.issues[0].message : 'Description and items are required'
        return context.json({ error: message }, { status: 400 })
      }

      let { description, items } = updateResult.value

      if (!description.trim()) {
        return context.json({ error: 'Description is required' }, { status: 400 })
      }

      if (items.length === 0) {
        return context.json({ error: 'Items array is required and must not be empty' }, { status: 400 })
      }

      let updated = await updateList(context.db, listId, { description, items })
      if (!updated) {
        return context.json({ error: 'List not found' }, { status: 404 })
      }

      return context.json({ id: listId, description })
    },
    async destroy(context) {
      let listId: number
      try {
        listId = s.parse(s.number(), Number(context.params.id))
      } catch {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      if (listId < 1) {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      let deleted = await deleteList(context.db, listId)
      if (!deleted) {
        return context.json({ error: 'List not found' }, { status: 404 })
      }

      return context.json({ deleted: true })
    },
  },
})
