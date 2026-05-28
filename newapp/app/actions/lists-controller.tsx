import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import { maxLength, minLength } from 'remix/data-schema/checks'

import { requireAuth } from '../middleware/auth.ts'
import { lists } from '../data/schema.ts'
import { ListsClient } from '../assets/lists-client.tsx'
import { ListsShowPage } from './lists-show-page.tsx'
import { Layout } from '../ui/layout.tsx'
import type { AppContext } from '../types/context.ts'
import { listsRoutes as routes } from '../routes.ts'

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
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      let parsed: { description: string; items: Array<{ id: string; label: string }> }
      try {
        parsed = s.parse(listsSaveSchema, body)
      } catch (err) {
        let message = 'Description and items are required'
        if (err instanceof s.ValidationError && err.issues.length > 0) {
          message = err.issues[0].message
        }
        return new Response(
          JSON.stringify({ error: message }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      let { description, items } = parsed

      if (!description.trim()) {
        return new Response(
          JSON.stringify({ error: 'Description is required' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      if (items.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Items array is required and must not be empty' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      let now = Date.now()
      let row = await db.create(
        lists,
        { list: items, description, created_at: now, updated_at: now },
        { returnRow: true },
      )

      return new Response(JSON.stringify({ id: row.id, description }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
    async listsData(context) {
      let db = context.db

      let listId: number
      try {
        listId = s.parse(s.number(), Number(context.params.id))
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid list ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (listId < 1) {
        return new Response(JSON.stringify({ error: 'Invalid list ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      let row = await db.findOne(lists, { where: { id: listId } })

      if (!row) {
        return new Response(JSON.stringify({ error: 'List not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(
        JSON.stringify({
          id: row.id,
          items: row.list,
          description: row.description,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
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
