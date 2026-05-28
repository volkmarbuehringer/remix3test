<!-- Context: development/remix3/guides | Priority: high | Version: 1.1 | Updated: 2026-04-20 -->

# Concept: Data-Controller Separation

**Core Idea**: Move data operations from page components to a separate data layer. Controller imports from data layer, page components are purely presentational.

**Key Points**:
- Page components should be presentational only (UI only)
- Controller owns data operations, imports from data layer
- Create `app/data/*.ts` files for database operations
- Types exported from both data layer and page components
- Use `as unknown as Type` for database return type conversions

**Quick Example**:
```typescript
// app/data/admin-courses.ts - Data layer
export async function loadCourses(db, page, sort) {
  return db.findMany(courses, { orderBy: sort, limit: pageSize, offset })
}

// courses-page.tsx - Presentational only
import type { Handle } from 'remix/ui'

type AdminCoursesPageProps = {
  courses: any[]
  page: number
  sort: string
}

export function AdminCoursesPage(handle: Handle<AdminCoursesPageProps>) {
  return () => {
    let { courses, page, sort } = handle.props
    return <table>...</table>
  }
}

// controller.tsx - Orchestrates
let result = await loadCourses(database, page, sort)
return render(<AdminCoursesPage courses={result.courses} ... />)
```

**Folder Structure**:
```
app/
├── data/
│   ├── schema.ts           # Database tables
│   └── admin-courses.ts    # Course data operations
└── actions/
    ├── controller.tsx      # Imports from data layer
    └── courses-page.tsx    # UI only
```

**Benefits**: Testability, reusability, standard patterns, maintainability.

**Reference**: `checker/app/data/schema.ts`

**Related**: `guides/split-controllers.md`, `guides/pagination.md`, `guides/form-patterns.md`