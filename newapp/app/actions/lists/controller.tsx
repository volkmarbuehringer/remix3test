import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import { maxLength, minLength } from 'remix/data-schema/checks'

import { requireAuth } from '../../middleware/auth.ts'
import { lists } from '../../data/schema.ts'
import { ListsClient } from '../../assets/lists-client.tsx'
import { ListsShowPage } from './show-page.tsx'
import { Layout } from '../../ui/layout.tsx'
import type { AppContext } from '../../types/context.ts'
import { listsRoutes as routes } from '../../routes.ts'

const listItemSchema = s.object({
  id: s.string(),
  label: s.string(),
})

const listsSaveSchema = s.object({
  description: s.string().pipe(minLength(1), maxLength(500)),
  items: s.array(listItemSchema),
})

export default createController<typeof routes, AppContext>(routes, {
  middleware: [requireAuth()],

  actions: {
    lists(context) {
      return context.render(
        <Layout>
          <ListsClient />
        </Layout>,
      )
    },
    async listsSave(context) {
      let db = context.db

      let body: unknown
      try {
        body = await context.request.json()
      } catch {
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

      let now = Date.now()
      let row =       await db.create(
        lists,
        { list: items, description, created_at: now, updated_at: now },
        { returnRow: true },
      )

      return context.json({ id: row.id, description })
    },
    async listsUpdate(context) {
      let db = context.db

      let listId: number
      try {
        listId = s.parse(s.number(), Number(context.params.id))
      } catch {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      if (listId < 1) {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      let existing = await db.findOne(lists, { where: { id: listId } })
      if (!existing) {
        return context.json({ error: 'List not found' }, { status: 404 })
      }

      let body: unknown
      try {
        body = await context.request.json()
      } catch {
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

      await db.updateMany(
        lists,
        { list: items, description },
        { where: { id: listId } },
      )

      return context.json({ id: listId, description })
    },
    async listsData(context) {
      let db = context.db

      let listId: number
      try {
        listId = s.parse(s.number(), Number(context.params.id))
      } catch {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      if (listId < 1) {
        return context.json({ error: 'Invalid list ID' }, { status: 400 })
      }

      let row = await db.findOne(lists, { where: { id: listId } })

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
    listsShow(context) {
      return context.render(
        <Layout>
          <ListsShowPage />
        </Layout>,
      )
    },
  },
})
