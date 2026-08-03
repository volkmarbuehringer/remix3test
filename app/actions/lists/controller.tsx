import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import * as s from 'remix/data-schema'
import { maxLength, minLength } from 'remix/data-schema/checks'

import { requireAuth } from '../../middleware/auth.ts'

import { ListsClient } from './lists-client.browser.tsx'
import { Layout } from '../../ui/layout.tsx'
import { routes } from '../../routes.ts'
import { getCurrentUser } from '../../utils/context.ts'
import {
  getListById,
  getAllLists,
  getListsByIds,
  createList,
  patchList,
  deleteList,
  moveItemBetweenLists,
} from '../../data/lists.ts'
import {
  renderListsPage,
  type ListsNavItem,
  type ListSidebarEntry,
  type ListInitialState,
  type PaginationState,
} from '../../ui/lists-layout.tsx'
import { ListsIndexPage } from '../../ui/lists-index-page.tsx'
import { getPageSize } from '../../utils/get-page-size.ts'

const listItemSchema = s.object({
  id: s.optional(s.string()),
  label: s.string(),
  done: s.optional(s.boolean()),
})

const listsCreateSchema = s.object({
  description: s.string().pipe(minLength(1), maxLength(500)),
  items: s.array(listItemSchema),
})

const listsPatchSchema = s.object({
  description: s.optional(s.string().pipe(minLength(1), maxLength(500))),
  items: s.optional(s.array(listItemSchema)),
})

const listsMoveSchema = s.object({
  targetId: s.number(),
  itemId: s.string(),
})

export default createController(routes.lists, {
  middleware: [requireAuth()],

  actions: {
    async index(context) {
      let user = getCurrentUser()
      let listUserId = user.role === 'admin' ? undefined : user.id

      let idsRaw = context.url.searchParams.get('ids')
      let sidebarEntries: ListSidebarEntry[]
      let listResult: PaginationState | undefined

      if (idsRaw?.trim()) {
        let ids = [
          ...new Set(
            idsRaw
              .split(',')
              .map(Number)
              .filter((n) => Number.isFinite(n) && n >= 1),
          ),
        ]
        let rows = await getListsByIds(context.db, ids, listUserId)
        sidebarEntries = rows.map((row) => ({
          id: `list:${row.id}` as ListsNavItem,
          label: row.description,
          count: Array.isArray(row.list) ? row.list.length : 0,
          doneCount: Array.isArray(row.list)
            ? row.list.filter((item) => item.done === true).length
            : 0,
          updatedAt: row.updated_at,
        }))
      } else {
        let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
        let pageSize = getPageSize(context.session, 15)
        let filter = context.url.searchParams.get('filter') || undefined

        let result = await getAllLists(context.db, { limit: pageSize, offset, filter }, listUserId)

        sidebarEntries = result.data.map((row) => ({
          id: `list:${row.id}` as ListsNavItem,
          label: row.description,
          count: Array.isArray(row.list) ? row.list.length : 0,
          doneCount: Array.isArray(row.list)
            ? row.list.filter((item) => item.done === true).length
            : 0,
          updatedAt: row.updated_at,
        }))
        listResult = { offset: result.offset, hasMore: result.hasMore, limit: pageSize }
      }

      let loadParam = context.url.searchParams.get('load')
      let activeItem: ListsNavItem
      let initialState: ListInitialState = null

      if (loadParam) {
        let listId = Number(loadParam)
        if (Number.isFinite(listId)) {
          let row = await getListById(context.db, listId, listUserId)
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
        listResult,
      )
    },

    async create(context) {
      let user = getCurrentUser()

      let body = context.jsonBody
      if (!body) {
        return context.json({ error: 'Invalid JSON body' }, { status: 400 })
      }

      let parseResult = s.parseSafe(listsCreateSchema, body)
      if (!parseResult.success) {
        let message =
          parseResult.issues.length > 0
            ? parseResult.issues[0].message
            : 'Description and non-empty items array are required'
        return context.json({ error: message }, { status: 400 })
      }

      let { description, items } = parseResult.value

      if (!description.trim()) {
        return context.json({ error: 'Description is required' }, { status: 400 })
      }

      if (items.length === 0) {
        return context.json({ error: 'Items array must not be empty' }, { status: 400 })
      }

      let row = await createList(context.db, { description, items }, user.id)
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
        context.logger?.('Invalid list ID in lists/update: ' + String(error))
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      if (listId < 1) {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      let body = context.jsonBody
      if (!body) {
        return context.json({ error: 'Invalid JSON body' }, { status: 400 })
      }

      let parseResult = s.parseSafe(listsPatchSchema, body)
      if (!parseResult.success) {
        let message =
          parseResult.issues.length > 0 ? parseResult.issues[0].message : 'Invalid fields'
        return context.json({ error: message }, { status: 400 })
      }

      let { description, items } = parseResult.value

      if (description === undefined && items === undefined) {
        return context.json({ error: 'At least description or items is required' }, { status: 400 })
      }

      if (items !== undefined && items.length === 0) {
        return context.json({ error: 'Items array must not be empty' }, { status: 400 })
      }

      let partial: {
        description?: string
        items?: Array<{ id?: string; label: string; done?: boolean }>
      } = {}
      if (description !== undefined) partial.description = description
      if (items !== undefined) partial.items = items

      let ifMatch = context.request.headers.get('If-Match')
      if (ifMatch == null && typeof body === 'object' && body !== null && '_if_match' in body) {
        let bf = (body as Record<string, unknown>)._if_match
        ifMatch = bf != null ? String(bf) : null
      }
      let expectedUpdatedAt = ifMatch ? Number(ifMatch) : undefined

      let result = await patchList(context.db, listId, partial, listUserId, { expectedUpdatedAt })
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

    async move(context) {
      let user = getCurrentUser()
      let listUserId = user.role === 'admin' ? undefined : user.id

      let sourceId: number
      try {
        sourceId = s.parse(s.number(), Number(context.params.id))
      } catch (error) {
        context.logger?.('Invalid list ID in lists/move: ' + String(error))
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      if (!Number.isInteger(sourceId) || sourceId < 1) {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      let body = context.jsonBody
      if (!body) {
        return context.json({ error: 'Invalid JSON body' }, { status: 400 })
      }

      let parseResult = s.parseSafe(listsMoveSchema, body)
      if (!parseResult.success) {
        let message =
          parseResult.issues.length > 0 ? parseResult.issues[0].message : 'Invalid fields'
        return context.json({ error: message }, { status: 400 })
      }

      let { targetId, itemId } = parseResult.value

      if (!Number.isInteger(targetId) || targetId < 1) {
        return context.json({ error: 'Invalid target ID' }, { status: 400 })
      }

      let ifMatch = context.request.headers.get('If-Match')
      if (ifMatch == null && typeof body === 'object' && body !== null && '_if_match' in body) {
        let bf = (body as Record<string, unknown>)._if_match
        ifMatch = bf != null ? String(bf) : null
      }
      let expectedUpdatedAt = ifMatch ? Number(ifMatch) : undefined
      if (expectedUpdatedAt == null || !Number.isFinite(expectedUpdatedAt)) {
        return context.json({ error: 'If-Match precondition is required' }, { status: 400 })
      }

      let result = await moveItemBetweenLists(context.db, sourceId, targetId, itemId, listUserId, {
        expectedUpdatedAt,
      })

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
      if (!result.ok && result.reason === 'same_list') {
        return context.json({ error: 'Cannot move an item into its own list' }, { status: 400 })
      }
      if (!result.ok && result.reason === 'last_item') {
        return context.json(
          { error: 'Cannot move the last remaining item of a list' },
          { status: 400 },
        )
      }
      if (!result.ok && result.reason === 'item_not_found') {
        return context.json({ error: 'Item not found in source list' }, { status: 400 })
      }

      return context.json({
        source: {
          id: result.source.id,
          description: result.source.description,
          items: result.source.list,
          updated_at: result.source.updated_at,
        },
        target: {
          id: result.target.id,
          description: result.target.description,
          items: result.target.list,
          updated_at: result.target.updated_at,
        },
      })
    },

    async destroy(context) {
      let user = getCurrentUser()
      let listUserId = user.role === 'admin' ? undefined : user.id

      let listId: number
      try {
        listId = s.parse(s.number(), Number(context.params.id))
      } catch (error) {
        context.logger?.('Invalid list ID in lists/destroy: ' + String(error))
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      if (listId < 1) {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      let deleted = await deleteList(context.db, listId, listUserId)
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
