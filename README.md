# newapp

A full-featured Remix 3 web application — no React, built with Remix UI components. Includes an admin dashboard, appointment management, AI chat/agent/workflow features, a client data lab, authentication, and a UI component showcase.

## Tech Stack

- **Framework:** [Remix 3](https://github.com/remix-run/remix) via retained `preview/main` tarballs (`t/<sha>/<pkg>.tgz`)
- **UI:** Remix UI (not React) — frame-based server-rendered components
- **Database:** PostgreSQL via `pg`
- **AI SDK:** `ai` + `@ai-sdk/openai-compatible` (chat, agent, workflow)
- **Testing:** Playwright (E2E + server integration tests)
- **Language:** TypeScript (Node ≥26.2, pnpm)

## Feature Overview

**Appointment Management** — A weekly calendar grid lets users book appointments against resources (rooms, equipment) within predefined time slots called "offerings." Supports drag-and-drop and resize interactions, quick-booking from templates, and real-time updates via Server-Sent Events so everyone sees changes instantly. A 24-hour cancellation policy applies, with admin bypass available.

**Admin Suite** — A full set of management tools behind the admin role. Admins can CRUD users, resources, offerings (individually or bulk-generated for an entire week from config templates), messages on the public board (with SSE for live updates), appointments (any user, bypassing policies), chat logs, lists, and offering configurations. Essentially everything in the app is manageable from the admin panel.

**AI Features** — Mastra-powered support agent with multi-turn chat, tool use (weather, user lookup), and persisted Mastra memory so you can pick up where you left off.

**In-App Notifications** — A per-user notification inbox that surfaces booking confirmations, reminders, and cancellations inside the app. A bell badge in the main navigation updates live via a per-user Server-Sent Events channel (no page reload), and each user only ever sees their own notifications. Notifications track read-state and link through to the related appointment.

**Lists** — User-created JSON-based lists with items, persisted on the server and accessible through REST-like CRUD endpoints. A flexible data store for simple structured content.

**Client Lab** — A frame-based CRUD demo and data grid that showcases Remix's frames architecture. Supports inline editing, sorting, filtering, and pagination — a reference implementation for building data-heavy UIs.

**UI Gallery** — A development-only living style guide at `/ui` that auto-discovers `*.demo.tsx` (or `.demo.ts` for non-JSX components) files under `app/ui`, server-renders them through the real document shell, theme, asset server, and client-entry runtime, and returns 404 outside development/test. Add a demo by dropping a component-default-export file next to the UI it documents.

**Authentication** — Register, log in, and log out backed by cookie-based sessions. Rate-limited to prevent abuse. Two roles — customer and admin — control access to different parts of the application.

All of this is wired together by a middleware pipeline that handles session management, authentication, CSRF protection, database context, and rendering. The app uses PostgreSQL for persistence, with automatic migration and seeding on first startup so you can be up and running with demo data in seconds.

## Architecture

```
app/routes.ts          → Route contract definitions (routes, authRoutes, adminRoutes, etc.)
app/router.ts          → createNewappRouter() wires routes → controller modules via router.map()
app/actions/           → Route action controllers organized by domain
app/middleware/        → Middleware stack (session, auth, csrf, render, database, etc.)
app/ui/                → Shared document shell, layouts, page components
app/assets/            → Client entry points and interactive components (browser-side modules)
app/assets.ts          → Asset server configuration (remix/assets)
app/data/              → Data access layer (database queries, models, migrations, seeding)
app/lib/               → Shared utilities (SSE, math, chatlog)
app/utils/             → Helper functions (context, DB, auth, rate limiting, pagination, etc.)
app/types/             → Shared TypeScript types (AppContext, etc.)
app/workflows/         → AI workflow definitions and engine
```

### Request Lifecycle

1. **`routes.ts`** — Declares typed route contracts using `get()`, `post()`, `put()`, `del()`, `form()`, `resources()`.
2. **`router.ts`** — Creates a `Router` with a middleware stack (logging, security, session, CSRF, database, auth, render) and maps route trees to controller modules.
3. **`app/actions/*`** — Controllers handle requests, access context, and return Remix UI trees.
4. **Conventional `render()` middleware** (`remix/middleware/render`, wired in `app/middleware/root.ts`) — Renders Remix UI nodes into HTML streams, resolving client entries and frame content.

Routes are organized into named trees:

- **Main routes** — `home`, `ui`, `client` (data lab)
- **Auth routes** — `login`, `register`, `logout`
- **Admin routes** — dashboard with stats/recent-activity/user-detail fragments, CRUD for users, resources, offering configs, lists, messages, appointments, offerings
- **Mastra routes** — Mastra chat with tool-using support agent
- **Appointment routes** — appointment management with event sourcing
- **Lists routes** — list CRUD with data views

### Admin Page / Form Base

Admin pages and forms are built on one shared, SSR-first contract to avoid drift:

- **Transport** — pages render through the shared frame runtime (`app/assets/entry.tsx`) via `renderAdminPage` (`createSidebarLayout`), and navigate/mutate with `data-rmx-target={frames.adminContent}`.
- **Controlled submission** — mutations validate server-side with `parseSafe`. On failure the controller re-renders the frame fragment at **status 200** with `fieldErrors` + preserved values (non-OK re-renders are treated as an unrecoverable error card by the frame transport). On success it redirects (**PRG**). See `app/ui/admin-grid-error.tsx` (`renderGridFormError`).
- **Row actions are server-rendered forms or links** — `RestfulForm` (POST/PUT/DELETE) carried by `data-rmx-target`; no client-side mutation `fetch`, no `frame.reload()`.
- **clientEntry is an input affordance only** — confirm/context menus submit an existing server form (`form.requestSubmit()`); it never mutates data directly.
- **Grid-state round-trip** — `_offset/_sort/_order/_filter` preserved on every mutation/navigation via `GridStateHiddenInputs` + `mixins/admin-urls.ts`.
- **Flash** — PRG errors for field-less actions (e.g. toggle) use `session.flash`, surfaced by the admin sidebar shell (`createSidebarLayout`).

The reference implementation is `app/actions/admin/users/controller.tsx` + `app/ui/admin-users-page.tsx`.

## Directory Structure

```
app/
├── routes.ts                  # Route contract definitions
├── router.ts                  # Router setup and middleware wiring
├── assets.ts                  # Asset server configuration
├── theme.tsx                  # Theme configuration
├── actions/                   # Route controllers by domain
│   ├── controller.tsx         #   Top-level routes
│   ├── admin/                 #   Admin route controllers
│   ├── auth/                  #   Auth route controllers
│   ├── mastra/                #   Mastra chat controller, agent, tools
│   ├── appointment/           #   Appointment controllers
│   ├── lists/                 #   List controllers
│   └── client/controller.tsx
├── assets/                    # Browser-side entry point & components
│   ├── entry.tsx              #   Browser entry point (Remix UI)
│   ├── theme-toggle.tsx
│   ├── connection-indicator.tsx
│   └── ...
├── data/                      # Data access layer
│   ├── connection.ts          #   PostgreSQL connection pool
│   ├── schema.ts              #   Database schema
│   ├── migrate.ts             #   Migration runner
│   ├── seed.ts                #   Seed data
│   ├── setup.ts               #   DB initialization
│   └── ...                    #   Model queries
├── middleware/                 # Middleware stack
│   ├── render.tsx             #   Request-scoped Remix UI renderer
│   ├── session.ts             #   Session cookie & storage
│   ├── auth.ts                #   Authentication middleware
│   ├── admin.ts               #   Admin authorization
│   ├── database.ts            #   Database context
│   ├── security-headers.ts    #   CORS, CSP, security
│   └── asset-entry.ts         #   Asset entry point loader
├── ui/                        # Shared UI components & pages
│   ├── document.tsx           #   HTML document shell
│   ├── layout.tsx             #   Main layout
│   ├── admin-layout.tsx       #   Admin layout
│   ├── ai-layout.tsx          #   AI dashboard layout
│   ├── nav.ts / nav-link.tsx  #   Navigation
│   ├── admin-*.tsx            #   Admin page components
│   ├── appointment-*.tsx      #   Appointment UI
│   ├── admin-mastra-chat-page.tsx
│   └── showcase-*             #   UI component showcase
├── lib/                       # Shared utilities
│   ├── sse.ts                 #   Server-Sent Events
│   ├── messages-sse.ts
│   ├── appointments-sse.ts
│   └── math.ts
├── utils/                     # Helper functions
│   ├── context.ts             #   App context helpers
│   ├── redirect.ts            #   Auth redirect helpers
│   ├── password-hash.ts       #   Password hashing
│   ├── rate-limiter.ts
│   ├── pagination.ts
│   ├── sort-params.ts
│   ├── date-utils.ts
│   ├── ids.ts                 #   ID generation
│   ├── error-handling.ts
│   ├── message-content.ts     #   Mastra message content extraction
│   ├── mastra-memory.ts       #   Mastra memory helpers
│   ├── thread-id.ts           #   Thread ID validation
│   └── ai-provider.ts         #   AI provider config
└── types/context.ts            # Shared AppContext type
tests/
├── e2e/                        # Playwright E2E tests
│   ├── auth.test.ts
│   ├── home.test.ts
│   ├── navigation.test.ts
│   ├── showcase.test.ts
│   └── theme.test.browser.ts
└── fixtures/                   # Test fixtures
server.ts                       # Server entry point (Node.js fetch, port 44100)
scripts/
└── postinstall.ts              # Post-install script (Playwright browsers)
docs/
└── DELETION_LOG.md
```

## Commands

```sh
npm i
npm run start
npm test
npm run typecheck
```

| Command               | Description                                     |
| --------------------- | ----------------------------------------------- |
| `npm run dev`         | Start dev server with file watching             |
| `npm run start`       | Start production server on port 44100           |
| `npm run test`        | Run Playwright E2E and server integration tests |
| `npm run typecheck`   | Type-check the project (`tsc --noEmit`)         |
| `npm run lint`        | Lint with oxlint                                |
| `npm run format`      | Check formatting with oxfmt                     |
| `npm run format:fix`  | Auto-format with oxfmt                          |
| `npm run db:status`   | Show applied / pending migrations               |
| `npm run db:migrate`  | Apply pending migrations                        |
| `npm run db:rollback` | Revert the newest migration                     |
| `npm run db:reset`    | Recreate the DB (requires `-- --force`)         |
| `npm run db:seed`     | Apply migrations and run the app seed           |

The development-only UI gallery is at `http://localhost:44100/ui` when
`NODE_ENV` is `development` or `test`. It auto-discovers `*.demo.tsx` (or
`.demo.ts`) files under `app/ui`, renders them through the real document shell
and asset server, and returns 404 outside development/test. Drop a new demo next
to the UI it documents; metadata comes from the leading JSDoc (`@name`,
`@description`, `@order`, `@layout center`), as in
`app/ui/theme/button.demo.tsx`.

## Database Setup

The app requires a PostgreSQL database. On startup, it automatically creates all required tables and seeds demo data if the database is empty.

### 1. Create a Database

Create a fresh PostgreSQL database:

```sh
createdb newapp
```

Or via `psql`:

```sql
CREATE DATABASE newapp;
```

### 2. Configure the Connection String

Set `DATABASE_URL` in your `.env` file (see [Environment](#environment) below for other variables):

```
DATABASE_URL="postgresql://user:password@localhost:5432/newapp"
```

Adjust the username, password, host, and port to match your PostgreSQL setup.

### 3. Migrations and Schema Bootstrap

When the server starts, [`initializeAppDatabase()`](app/db.ts) applies pending SQL migrations from [`db/migrations`](db/migrations) through the `remix/data-table` runner and then seeds default data. The baseline migration is idempotent, so an existing database adopts the migration journal on its first boot without manual bookkeeping.

Use the migration commands to inspect or change the schema deliberately:

```sh
npm run db:status    # applied / pending / drifted / missing
npm run db:migrate   # apply pending migrations
npm run db:rollback  # revert the newest migration
npm run db:reset -- --force  # recreate the database (destructive)
npm run db:seed      # apply pending migrations and seed
```

Never edit an applied migration: the runner checksums `up.sql` and fails the next boot on drift. Add a new migration directory instead. See [`db/migrations/README.md`](db/migrations/README.md) and the tables in the baseline at [`db/migrations/20261101000000_baseline/up.sql`](db/migrations/20261101000000_baseline/up.sql).

The schema enables the `pg_trgm`, `btree_gist`, and `pgcrypto` PostgreSQL extensions.

### 4. Auto-Seed Demo Data

After migrations, [`seed()`](app/data/seed.ts) checks whether the `users` table is empty. If it is (fresh database), it inserts the following demo data:

- **2 users** — admin and customer accounts (see credentials below)
- **3 messages** — welcome posts on the public message board
- **200 clients** — demo records for the Client Data Lab
- **2 resources** — `resource1` and `resource2`
- **Offering configs** — scheduling rules per resource (JSONB)
- **5 offerings** — Mon–Fri 8:00–18:00 time slots for the current week

**Seed runs only once.** If the database already contains users, seeding is skipped and existing data is preserved.

### Demo Accounts

| Role     | Email            | Password    |
| -------- | ---------------- | ----------- |
| Admin    | admin@newapp.com | admin123    |
| Customer | user@newapp.com  | password123 |

## Environment

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL` — PostgreSQL connection string (see [Database Setup](#database-setup))
- `AI_API_KEY` / `AI_BASE_URL` — OpenAI-compatible AI provider
- `SESSION_SECRET` — Session encryption secret
- `PORT` — Server port (default: 44100)

## Testing

Tests use Playwright and the `remix` test runner. They run against a real server instance and a test database.

```sh
npm test              # Run all tests
```

Tests cover:

- **E2E:** authentication flow, navigation, home page, showcase, theme toggle
- **Server integration:** admin controllers (users, resources, offerings, appointments, chat logs, messages, fragments), auth (login, register, logout), AI (chat, agent, fragments), appointments, lists, client controller
