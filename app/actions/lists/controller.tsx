import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import * as s from 'remix/data-schema'
import { maxLength, minLength } from 'remix/data-schema/checks'
import { Logger } from 'remix/middleware/logger'

import { requireAuth } from '../../middleware/auth.ts'
import { JsonBody } from '../../middleware/json-body.ts'
import { ListsClient } from '../../assets/lists-client.tsx'
import { ListsShowPage } from './show-page.tsx'
import { Layout } from '../../ui/layout.tsx'
import { routes } from '../../routes.ts'
import { pool, db } from '../../data/setup.ts'
import type { AppContext } from '../../types/context.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { getListById, getAllLists, createList, updateList, renameList, deleteList } from '../../lib/lists-api.ts'
import { renderListsPage, type ListsNavItem, type ListSidebarEntry } from '../../ui/lists-layout.tsx'
import { ListsIndexPage } from '../../ui/lists-index-page.tsx'
import { getPageSize } from '../../utils/get-page-size.ts'

const listItemSchema = s.object({
  id: s.string(),
  label: s.string(),
})

const listsSaveSchema = s.object({
  description: s.string().pipe(minLength(1), maxLength(500)),
  items: s.array(listItemSchema),
})

export default createController<typeof routes.lists, AppContext>(routes.lists, {
  middleware: [requireAuth()],

  actions: {
    async index(context) {
      let user = getCurrentUser()
      let listUserId = user.role === 'admin' ? undefined : user.id
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let pageSize = getPageSize(context.session, 15)
      let result = await getAllLists(db, pool, { limit: pageSize, offset }, listUserId)

      let sidebarEntries: ListSidebarEntry[] = result.data.map((row) => ({
        id: `list:${row.id}` as ListsNavItem,
        label: row.description,
        count: Array.isArray(row.list) ? row.list.length : 0,
      }))

      let loadParam = context.url.searchParams.get('load')
      let activeItem: ListsNavItem
      if (loadParam) {
        let listId = Number(loadParam)
        if (Number.isFinite(listId) && sidebarEntries.some((e) => e.id === `list:${listId}`)) {
          activeItem = `list:${listId}` as ListsNavItem
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
        <ListsIndexPage />,
        { offset: result.offset, hasMore: result.hasMore, limit: pageSize },
      )
    },
    async save(context) {
      let db = context.db
      let user = getCurrentUser()

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

      let row = await createList(db, { description, items }, user.id)
      return context.json({ id: row.id, description: row.description })
    },
    async update(context) {
      let db = context.db
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

      let updated = await updateList(db, listId, { description, items }, listUserId)
      if (!updated) {
        return context.json({ error: 'List not found' }, { status: 404 })
      }

      return context.json({ id: listId, description })
    },
    async rename(context) {
      let db = context.db
      let user = getCurrentUser()
      let listUserId = user.role === 'admin' ? undefined : user.id

      let listId: number
      try {
        listId = s.parse(s.number(), Number(context.params.id))
      } catch (error) {
        context.get(Logger)?.('Invalid list ID in lists/rename: ' + String(error))
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      if (listId < 1) {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      let body = context.get(JsonBody)
      if (!body) {
        return context.json({ error: 'Invalid JSON body' }, { status: 400 })
      }

      let renameSchema = s.object({
        description: s.string().pipe(minLength(1), maxLength(500)),
      })

      let parseResult = s.parseSafe(renameSchema, body)
      if (!parseResult.success) {
        let message = parseResult.issues.length > 0 ? parseResult.issues[0].message : 'Description is required'
        return context.json({ error: message }, { status: 400 })
      }

      let { description } = parseResult.value

      if (!description.trim()) {
        return context.json({ error: 'Description is required' }, { status: 400 })
      }

      let updated = await renameList(db, listId, description, listUserId)
      if (!updated) {
        return context.json({ error: 'List not found' }, { status: 404 })
      }

      return context.json({ id: listId, description })
    },
    async data(context) {
      let db = context.db
      let user = getCurrentUser()
      let listUserId = user.role === 'admin' ? undefined : user.id

      let listId: number
      try {
        listId = s.parse(s.number(), Number(context.params.id))
      } catch (error) {
        context.get(Logger)?.('Invalid list ID in lists/data: ' + String(error))
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      if (listId < 1) {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      let row = await getListById(db, listId, listUserId)
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
    async destroy(context) {
      let db = context.db
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
    show(context) {
      return context.render(
        <Layout>
          <ListsShowPage />
        </Layout>,
      )
    },
  },
})
