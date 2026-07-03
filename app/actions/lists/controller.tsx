import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import * as s from 'remix/data-schema'
import { maxLength, minLength } from 'remix/data-schema/checks'
import { Logger } from 'remix/middleware/logger'

import { requireAuth } from '../../middleware/auth.ts'
import { JsonBody } from '../../middleware/json-body.ts'
import { ListsClient } from '../../assets/lists-client.tsx'
import { Layout } from '../../ui/layout.tsx'
import { routes } from '../../routes.ts'
import { pool, db } from '../../data/setup.ts'
import type { AppContext } from '../../types/context.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { getListById, getAllLists, createList, patchList, deleteList } from '../../lib/lists-api.ts'
import { renderListsPage, type ListsNavItem, type ListSidebarEntry, type ListInitialState } from '../../ui/lists-layout.tsx'
import { ListsIndexPage } from '../../ui/lists-index-page.tsx'
import { getPageSize } from '../../utils/get-page-size.ts'

const listItemSchema = s.object({
  id: s.optional(s.string()),
  label: s.string(),
})

const listsCreateSchema = s.object({
  description: s.string().pipe(minLength(1), maxLength(500)),
  items: s.array(listItemSchema),
})

const listsPatchSchema = s.object({
  description: s.optional(s.string().pipe(minLength(1), maxLength(500))),
  items: s.optional(s.array(listItemSchema)),
})

export default createController<typeof routes.lists, AppContext>(routes.lists, {
  middleware: [requireAuth()],

  actions: {
    async index(context) {
      let user = getCurrentUser()
      let listUserId = user.role === 'admin' ? undefined : user.id
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let pageSize = getPageSize(context.session, 15)
      let filter = context.url.searchParams.get('filter') || undefined

      let result = await getAllLists(db, pool, { limit: pageSize, offset, filter }, listUserId)

      let sidebarEntries: ListSidebarEntry[] = result.data.map((row) => ({
        id: `list:${row.id}` as ListsNavItem,
        label: row.description,
        count: Array.isArray(row.list) ? row.list.length : 0,
        updatedAt: row.updated_at,
      }))

      let loadParam = context.url.searchParams.get('load')
      let activeItem: ListsNavItem
      let initialState: ListInitialState = null

      if (loadParam) {
        let listId = Number(loadParam)
        if (Number.isFinite(listId)) {
          let row = await getListById(db, listId, listUserId)
          if (row) {
            activeItem = `list:${listId}` as ListsNavItem
            initialState = {
              id: row.id,
              description: row.description,
              items: row.list,
              updated_at: row.updated_at,
            }
          } else {
            activeItem = 'new'
          }
        } else {
          activeItem = 'new'
        }
      } else {
        activeItem = 'new'
      }

      return renderListsPage(
        context.render,
        activeItem,
        sidebarEntries,
        <ListsIndexPage initialState={initialState} />,
        { offset: result.offset, hasMore: result.hasMore, limit: pageSize },
      )
    },

    async create(context) {
      let user = getCurrentUser()

      let body = context.get(JsonBody)
      if (!body) {
        return context.json({ error: 'Invalid JSON body' }, { status: 400 })
      }

      let parseResult = s.parseSafe(listsCreateSchema, body)
      if (!parseResult.success) {
        let message = parseResult.issues.length > 0 ? parseResult.issues[0].message : 'Description and non-empty items array are required'
        return context.json({ error: message }, { status: 400 })
      }

      let { description, items } = parseResult.value

      if (!description.trim()) {
        return context.json({ error: 'Description is required' }, { status: 400 })
      }

      if (items.length === 0) {
        return context.json({ error: 'Items array must not be empty' }, { status: 400 })
      }

      let row = await createList(db, { description, items }, user.id)
      return context.json({
        id: row.id,
        description: row.description,
        items: row.list,
        updated_at: row.updated_at,
      })
    },

    async update(context) {
      let user = getCurrentUser()
      let listUserId = user.role === 'admin' ? undefined : user.id

      let listId: number
      try {
        listId = s.parse(s.number(), Number(context.params.id))
      } catch (error) {
        context.get(Logger)?.('Invalid list ID in lists/update: ' + String(error))
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      if (listId < 1) {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      let body = context.get(JsonBody)
      if (!body) {
        return context.json({ error: 'Invalid JSON body' }, { status: 400 })
      }

      let parseResult = s.parseSafe(listsPatchSchema, body)
      if (!parseResult.success) {
        let message = parseResult.issues.length > 0 ? parseResult.issues[0].message : 'Invalid fields'
        return context.json({ error: message }, { status: 400 })
      }

      let { description, items } = parseResult.value

      if (description === undefined && items === undefined) {
        return context.json({ error: 'At least description or items is required' }, { status: 400 })
      }

      if (items !== undefined && items.length === 0) {
        return context.json({ error: 'Items array must not be empty' }, { status: 400 })
      }

      let partial: { description?: string; items?: Array<{ id?: string; label: string }> } = {}
      if (description !== undefined) partial.description = description
      if (items !== undefined) partial.items = items

      let ifMatch = context.request.headers.get('If-Match')
      if (ifMatch == null && typeof body === 'object' && body !== null && '_if_match' in body) {
        let bf = (body as Record<string, unknown>)._if_match
        ifMatch = bf != null ? String(bf) : null
      }
      let expectedUpdatedAt = ifMatch ? Number(ifMatch) : undefined

      let result = await patchList(db, listId, partial, listUserId, { expectedUpdatedAt })
      if (!result.ok && result.reason === 'not_found') {
        return context.json({ error: 'List not found' }, { status: 404 })
      }
      if (!result.ok && result.reason === 'conflict') {
        return context.json(
          {
            id: result.current.id,
            description: result.current.description,
            items: result.current.list,
            updated_at: result.current.updated_at,
          },
          { status: 409, headers: { ETag: String(result.current.updated_at) } },
        )
      }

      return context.json({
        id: result.row.id,
        description: result.row.description,
        items: result.row.list,
        updated_at: result.row.updated_at,
      })
    },

    async destroy(context) {
      let user = getCurrentUser()
      let listUserId = user.role === 'admin' ? undefined : user.id

      let listId: number
      try {
        listId = s.parse(s.number(), Number(context.params.id))
      } catch (error) {
        context.get(Logger)?.('Invalid list ID in lists/destroy: ' + String(error))
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      if (listId < 1) {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      let deleted = await deleteList(db, listId, listUserId)
      if (!deleted) {
        return context.json({ error: 'List not found' }, { status: 404 })
      }

      let redirectUrl = routes.lists.index.href()
      let offset = context.url.searchParams.get('offset')
      if (offset) {
        redirectUrl += '?offset=' + encodeURIComponent(offset)
      }
      return redirect(redirectUrl)
    },
  },
})
