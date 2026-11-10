import {
  and,
  ilike,
  isNull,
  notNull,
  or,
  type Database,
  type SingleTableWhere,
} from 'remix/data-table'

import { users } from './schema.ts'
import type { User } from './schema.ts'
import { paginate } from '../utils/pagination.ts'
import { parseSort } from '../utils/sort-params.ts'
import { parseUserStatus, type UserStatus } from '../utils/user-status.ts'

/** User fields safe to send to the client (never the password hash). */
export type SafeUser = Pick<
  User,
  'id' | 'email' | 'name' | 'role' | 'email_verified' | 'disabled_at' | 'created_at' | 'updated_at'
>

/**
 * Columns the admin users grid can sort by. The selected value reaches
 * ORDER BY, so it must be checked against this whitelist rather than trusted.
 */
export const USERS_SORTABLE_FIELDS = ['id', 'name', 'email', 'role', 'created_at'] as const

/**
 * Row cap for the users PDF export. `PDF_TRUNCATED_NOTE` states "10.000
 * Einträge", so keep the two in sync.
 */
export const USERS_EXPORT_LIMIT = 10_000

/** The users grid's view state, parsed once for the page and its exports. */
export interface UsersQuery {
  filter: string | undefined
  status: UserStatus | undefined
  column: string
  direction: 'asc' | 'desc'
}

/**
 * Resolve the status filter from the dedicated `status` param, falling back to
 * the legacy `filter=enabled|disabled` form (bookmarks, agent navigation, and
 * the users-export links still use it). The text search and the status filter
 * are independent axes, so a disabled account can also be found by name.
 */
function resolveUserStatus(
  filter: string | undefined,
  statusParam: string | undefined,
): UserStatus | undefined {
  return parseUserStatus(statusParam) ?? parseUserStatus(filter)
}

/**
 * The text-search term. A legacy `filter=enabled|disabled` token is always a
 * status, never a search term — including when a `status` param is also
 * present, so `?filter=enabled&status=disabled` cannot accidentally search
 * names for the literal string "enabled".
 */
function resolveUserFilter(filter: string | undefined): string | undefined {
  return parseUserStatus(filter) ? undefined : filter
}

/**
 * Parse the users grid view (search, status, sort) from a URL. The HTML page
 * and the PDF export both use this so the file cannot disagree with the rows
 * on screen.
 */
export function parseUsersQuery(url: URL): UsersQuery {
  let filterParam = url.searchParams.get('filter') || undefined
  let statusParam = url.searchParams.get('status') || undefined
  let { column, direction } = parseSort(url, {
    allowedColumns: USERS_SORTABLE_FIELDS,
    defaultColumn: 'name',
    defaultDirection: 'asc',
  })

  return {
    filter: resolveUserFilter(filterParam),
    status: resolveUserStatus(filterParam, statusParam),
    column,
    direction,
  }
}

export function toSafeUser(u: User): SafeUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    email_verified: u.email_verified,
    disabled_at: u.disabled_at,
    created_at: u.created_at,
    updated_at: u.updated_at,
  }
}

/** Escape LIKE wildcards so a text filter is treated as a literal substring
 *  (mirrors the admin-lists search). Without this, an email like
 *  `john_doe@x.com` matches `johnXdoe@x.com` too. */
function likePattern(value: string): string {
  return `%${value.replace(/[%_\\]/g, '\\$&')}%`
}

function buildUsersFilterPredicate(
  filter?: string,
  status?: UserStatus,
): SingleTableWhere<typeof users> | undefined {
  let term = filter?.trim()
  let filterPredicate: SingleTableWhere<typeof users> | undefined = term
    ? /^\d+$/.test(term)
      ? { id: Number(term) }
      : or(ilike('name', likePattern(term)), ilike('email', likePattern(term)))
    : undefined
  let statusPredicate: SingleTableWhere<typeof users> | undefined =
    status === 'enabled'
      ? isNull('disabled_at')
      : status === 'disabled'
        ? notNull('disabled_at')
        : undefined

  if (filterPredicate && statusPredicate) return and(filterPredicate, statusPredicate)
  return filterPredicate ?? statusPredicate
}

export interface LoadUsersPageOptions {
  offset: number
  column: string
  direction: 'asc' | 'desc'
  filter?: string | undefined
  status?: UserStatus | undefined
  pageSize: number
}

export interface UsersPageResult {
  rows: SafeUser[]
  hasMore: boolean
  total: number
}

/**
 * Load one users page plus the total for the same filter. The PDF export calls
 * this with offset 0 and a large page size so it receives the whole filtered
 * result set in the grid's sort order.
 */
export async function loadUsersPage(
  db: Database,
  opts: LoadUsersPageOptions,
): Promise<UsersPageResult> {
  let pageNum = Math.floor(opts.offset / opts.pageSize) + 1
  let where = buildUsersFilterPredicate(opts.filter, opts.status)
  let [total, { items: page, hasMore }] = await Promise.all([
    db.count(users, where ? { where } : undefined),
    paginate(db, users, {
      pageSize: opts.pageSize,
      page: pageNum,
      orderBy: [[opts.column, opts.direction]],
      ...(where ? { where } : {}),
    }),
  ])

  let rows = (page as User[]).map(toSafeUser)
  return { rows, hasMore, total }
}
