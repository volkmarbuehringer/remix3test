/**
 * Shared test router instance.
 *
 * This module exists so that tests can import a pre-constructed router
 * (with a single middleware stack built once at module-eval time) without
 * importing the singleton from `router.ts`.
 *
 * Previously `app/router.ts` exported `export const router = createNewappRouter()`
 * at module scope.  ~44 test files imported that singleton.  Moving it here
 * keeps existing test behaviour identical while letting `app/router.ts`
 * export only the factory function -- the production composition root.
 */
import { createNewappRouter } from './router.ts'

export const router = createNewappRouter()
