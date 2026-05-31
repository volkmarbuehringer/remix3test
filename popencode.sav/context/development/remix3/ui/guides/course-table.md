<!-- Context: development/remix3/guides/course-table | Priority: medium | Version: 1.0 | Updated: 2026-03-31 -->

# Course Table with User Association

Pattern for creating user-scoped data tables in Remix 3 with PostgreSQL.

## Key Points

- Use `user_id` foreign key to associate records with logged-in users
- Query courses filtered by current user via `getCurrentUserId()`
- Seed data in `app/data/setup.ts` with idempotent checks
- Use `findMany()` with `where` clause for filtered queries

## Migration Pattern

```typescript
// db/migrations/20260331000000_create_courses.ts
import { createMigration } from 'remix/data-table/migrations'

export default createMigration({
  async up({ schema }) {
    await schema.plan(`
      CREATE TABLE courses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        description TEXT,
        created_at BIGINT NOT NULL
      )
    `)
    await schema.createIndex('courses', 'user_id', { name: 'courses_user_id_idx' })
  },
  async down({ schema }) {
    await schema.dropTable('courses', { ifExists: true })
  },
})
```

## Schema Pattern

```typescript
// app/data/schema.ts
export const courses = table({
  name: 'courses',
  columns: {
    id: c.integer(),
    user_id: c.integer(),
    title: c.text(),
    description: c.text(),
    created_at: c.bigint(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }
    if (operation === 'create' && next.created_at === undefined) {
      next.created_at = Date.now()
    }
    return { value: next }
  },
  afterRead({ value }) {
    if (typeof value.created_at === 'string') {
      value.created_at = Number(value.created_at)
    }
    return { value }
  },
})
```

## Query Courses for Current User

```typescript
// Get current user in controller
let userId = getCurrentUser()?.id
let userCourses = await database.findMany(courses, { where: { user_id: userId } })
```

## Auth Helper

```typescript
// app/middleware/auth.ts
export function getCurrentUser(): User | null {
  let authState = getContext().get(Auth) as AuthState<User> | undefined
  if (authState?.ok && authState.identity) {
    return authState.identity
  }
  return null
}
```

## Seeding Pattern

```typescript
// app/data/setup.ts
let courseTitles = ['Course 1', 'Course 2', ...]
let existingCount = Number(await db.count(courses, { where: { user_id: 1 } }))
if (existingCount < courseTitles.length) {
  for (let title of courseTitles) {
    await db.create(courses, { user_id: 1, title, created_at: Date.now() })
  }
}
```

## Related

- `database-initialization.md` - PostgreSQL setup
- `postgresql-migration.md` - Migration patterns
- `auth-middleware.md` - Auth with user context
