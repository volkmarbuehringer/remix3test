import type { MiddlewareContext } from 'remix/router'
import type { formData } from 'remix/middleware/form-data'
import type { session } from 'remix/middleware/session'

import type { json } from '../middleware/json-render.ts'
import type { render } from '../middleware/render.tsx'
import type { loadDatabase } from '../middleware/database.ts'
import type { loadAuth } from '../middleware/auth.ts'

type RootMiddleware = [
  ReturnType<typeof formData>,
  ReturnType<typeof session>,
  ReturnType<typeof loadDatabase>,
  ReturnType<typeof loadAuth>,
  ReturnType<typeof render>,
  ReturnType<typeof json>,
]

export type AppContext = MiddlewareContext<RootMiddleware>
