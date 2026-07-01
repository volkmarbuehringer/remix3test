import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import { maxLength, minLength } from 'remix/data-schema/checks'
import { Logger } from 'remix/middleware/logger'

import { requireAuth } from '../../middleware/auth.ts'
import { JsonBody } from '../../middleware/json-body.ts'
import { ListsClient } from '../../assets/lists-client.tsx'
import { ListsShowPage } from './show-page.tsx'
import { Layout } from '../../ui/layout.tsx'
import { routes } from '../../routes.ts'
import { pool } from '../../data/setup.ts'
import type { AppContext } from '../../types/context.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { getListById, createList, updateList } from '../../lib/lists-api.ts'

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
    index(context) {
      return context.render(
        <Layout>
          <ListsClient />
        </Layout>,
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
    show(context) {
      return context.render(
        <Layout>
          <ListsShowPage />
        </Layout>,
      )
    },
  },
})
