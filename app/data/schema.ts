import { column as c, table, type ColumnBuilder, DataTableConstraintError } from 'remix/data-table'
import type { TableRow } from 'remix/data-table'
import { parseIntFields } from '../utils/schema-utils.ts'

/**
 * BIGINT column that TypeScript treats as `number`.
 * pg returns BIGINT as string; parseIntFields in afterRead converts it back.
 */
function bigint(): ColumnBuilder<number> {
  return c.bigint() as unknown as ColumnBuilder<number>
}

function bigintNullable(): ColumnBuilder<number | null> {
  return c.bigint().nullable() as unknown as ColumnBuilder<number | null>
}

function validateAppointmentTimes(
  start_min: unknown,
  end_min: unknown,
  issues?: Array<{ message: string; path?: Array<string | number> }>,
): void {
  if ((start_min === undefined) !== (end_min === undefined)) {
    let msg = 'Both start_min and end_min are required when specifying time changes.'
    if (issues) {
      issues.push({ message: msg, path: ['start_min'] })
    } else {
      throw new DataTableConstraintError(msg)
    }
    return
  }
  if (typeof start_min !== 'number' || typeof end_min !== 'number') return
  if (start_min < 0 || start_min > 1440) {
    let msg = 'start_min must be between 0 and 1440.'
    if (issues) issues.push({ message: msg, path: ['start_min'] })
    else throw new DataTableConstraintError(msg)
    return
  }
  if (end_min < 0 || end_min > 1440) {
    let msg = 'end_min must be between 0 and 1440.'
    if (issues) issues.push({ message: msg, path: ['end_min'] })
    else throw new DataTableConstraintError(msg)
    return
  }
  if (start_min >= end_min) {
    let msg = 'start_min must be less than end_min.'
    if (issues) issues.push({ message: msg, path: ['start_min'] })
    else throw new DataTableConstraintError(msg)
    return
  }
}

export const users = table({
  name: 'users',
  columns: {
    id: c.integer(),
    email: c.text(),
    password_hash: c.text(),
    name: c.text(),
    role: c.enum(['customer', 'admin']),
    email_verified: c.integer(),
    verification_token: c.text().nullable(),
    verification_expires: bigintNullable(),
    password_reset_token: c.text().nullable(),
    password_reset_expires: bigintNullable(),
    token_version: c.integer(),
    disabled_at: bigintNullable(),
    created_at: bigint(),
    updated_at: bigint(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }

    if (typeof next.name === 'string') {
      next.name = next.name.trim()
    }

    if (typeof next.email === 'string') {
      next.email = next.email.trim().toLowerCase()
    }

    if (typeof next.password_hash === 'string') {
      next.password_hash = next.password_hash.trim()
    }

    if (operation === 'create' && next.role === undefined) {
      next.role = 'customer'
    }

    if (operation === 'create' && next.email_verified === undefined) {
      next.email_verified = 0
    }

    if (operation === 'create' && next.created_at === undefined) {
      next.created_at = Date.now()
    }

    if (operation === 'create' && next.updated_at === undefined) {
      next.updated_at = Date.now()
    }

    if (operation === 'update') {
      next.updated_at = Date.now()
    }

    return { value: next }
  },
  validate({ operation, value }) {
    let issues: Array<{ message: string; path?: Array<string | number> }> = []
    let email = typeof value.email === 'string' ? value.email.trim().toLowerCase() : undefined
    let name = typeof value.name === 'string' ? value.name.trim() : undefined

    if (operation === 'create' && !name) {
      issues.push({ message: 'Name is required.', path: ['name'] })
    }

    if (name !== undefined && name.length === 0) {
      issues.push({ message: 'Name is required.', path: ['name'] })
    }

    if (operation === 'create' && !email) {
      issues.push({ message: 'Email is required.', path: ['email'] })
    }

    if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      issues.push({ message: 'Email address is invalid.', path: ['email'] })
    }

    if (
      (operation === 'create' && typeof value.password_hash !== 'string') ||
      (typeof value.password_hash === 'string' && value.password_hash.length === 0)
    ) {
      issues.push({
        message: 'Password is required.',
        path: ['password_hash'],
      })
    }

    return issues.length > 0 ? { issues } : { value }
  },
  afterRead({ value }) {
    parseIntFields(value, 'created_at', 'updated_at', 'disabled_at')
    return { value }
  },
})

export const messages = table({
  name: 'messages',
  primaryKey: ['id'],
  columns: {
    id: c.integer(),
    sender_id: c.integer(),
    content: c.text(),
    created_at: bigint(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }
    if (operation === 'create' && next.created_at === undefined) {
      next.created_at = Date.now()
    }
    return { value: next }
  },
  afterRead({ value }) {
    parseIntFields(value, 'created_at')
    return { value }
  },
})

export const clients = table({
  name: 'clients',
  primaryKey: ['id'],
  columns: {
    id: c.integer(),
    name: c.text(),
    email: c.text(),
    role: c.text(),
    status: c.text(),
    registered: bigint(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }

    if (typeof next.name === 'string') {
      next.name = next.name.trim()
    }

    if (typeof next.email === 'string') {
      next.email = next.email.trim().toLowerCase()
    }

    if (operation === 'create' && next.role === undefined) {
      next.role = 'Viewer'
    }

    if (operation === 'create' && next.status === undefined) {
      next.status = 'Active'
    }

    if (operation === 'create' && next.registered === undefined) {
      next.registered = Date.now()
    }

    if (typeof next.registered === 'string') {
      let ts = new Date(next.registered).getTime()
      if (!Number.isNaN(ts)) next.registered = ts
    }

    return { value: next }
  },
  validate({ operation, value }) {
    let issues: Array<{ message: string; path?: Array<string | number> }> = []
    let name = typeof value.name === 'string' ? value.name.trim() : undefined

    if (operation === 'create' && !name) {
      issues.push({ message: 'Name is required.', path: ['name'] })
    }

    if (name !== undefined && name.length === 0) {
      issues.push({ message: 'Name is required.', path: ['name'] })
    }

    return issues.length > 0 ? { issues } : { value }
  },
  afterRead({ value }) {
    parseIntFields(value, 'registered')
    return { value }
  },
})

export const lists = table({
  name: 'lists',
  primaryKey: ['id'],
  columns: {
    id: c.integer(),
    user_id: c.integer(),
    list: c.json(),
    title: c.text(),
    description: c.text(),
    created_at: bigint(),
    updated_at: bigint(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }

    if (typeof next.title === 'string') {
      next.title = next.title.trim()
    }

    if (typeof next.description === 'string') {
      next.description = next.description.trim()
    }

    if (Array.isArray(next.list)) {
      next.list = JSON.stringify(next.list)
    }

    if (operation === 'create') {
      let now = Date.now()
      if (next.created_at === undefined) next.created_at = now
      if (next.updated_at === undefined) next.updated_at = now
    }

    if (operation === 'update') {
      next.updated_at = Date.now()
    }

    return { value: next }
  },
  afterRead({ value }) {
    parseIntFields(value, 'created_at', 'updated_at', 'user_id')
    if (typeof value.list === 'string') {
      try {
        value.list = JSON.parse(value.list)
      } catch {
        value.list = []
      }
    }
    return { value }
  },
})

export const appointments = table({
  name: 'appointments',
  primaryKey: ['id'],
  columns: {
    id: c.integer(),
    user_id: c.integer(),
    resource_id: c.integer(),
    title: c.text(),
    date: bigint(),
    created_at: bigint(),
    updated_at: bigint(),
    during: c.text(),
    start_min: c.integer().computed('lower(during)', { stored: true }),
    end_min: c.integer().computed('upper(during)', { stored: true }),
  },
  validate({ operation, value }) {
    let issues: Array<{ message: string; path?: Array<string | number> }> = []

    if (operation === 'create' && value.resource_id === undefined) {
      issues.push({
        message: 'resource_id is required.',
        path: ['resource_id'],
      })
    }

    validateAppointmentTimes(value.start_min, value.end_min, issues)

    return issues.length > 0 ? { issues } : { value }
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }

    // Validate and convert start_min/end_min to during range string
    validateAppointmentTimes(next.start_min, next.end_min)
    if (next.start_min !== undefined && next.end_min !== undefined) {
      next.during = `[${next.start_min},${next.end_min})`
    }
    // Strip generated columns — cannot be written directly
    delete next.start_min
    delete next.end_min

    if (operation === 'create') {
      let now = Date.now()
      if (next.created_at === undefined) next.created_at = now
      if (next.updated_at === undefined) next.updated_at = now
    }

    if (operation === 'update') {
      next.updated_at = Date.now()
    }

    return { value: next }
  },
  afterRead({ value }) {
    parseIntFields(value, 'created_at', 'updated_at', 'date', 'resource_id')
    if (typeof value.during === 'object' && value.during !== null) {
      let r = value.during as { lower: unknown; upper: unknown }
      value.during = `[${r.lower},${r.upper})`
    }
    return { value }
  },
})

export const appointtypes = table({
  name: 'appointtypes',
  primaryKey: ['id'],
  columns: {
    id: c.integer(),
    user_id: c.integer(),
    title: c.text(),
    created_at: bigint(),
    updated_at: bigint(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }

    if (operation === 'create') {
      let now = Date.now()
      if (next.created_at === undefined) next.created_at = now
      if (next.updated_at === undefined) next.updated_at = now
    }

    if (operation === 'update') {
      next.updated_at = Date.now()
    }

    return { value: next }
  },
  afterRead({ value }) {
    parseIntFields(value, 'created_at', 'updated_at')
    return { value }
  },
})

export const resources = table({
  name: 'resources',
  primaryKey: ['id'],
  columns: {
    id: c.integer(),
    name: c.text(),
    description: c.text(),
    capabilities: c.text(),
    created_at: bigint(),
    updated_at: bigint(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }

    if (typeof next.name === 'string') {
      next.name = next.name.trim()
    }

    if (typeof next.description === 'string') {
      next.description = next.description.trim()
    }

    if (operation === 'create') {
      let now = Date.now()
      if (next.created_at === undefined) next.created_at = now
      if (next.updated_at === undefined) next.updated_at = now
    }

    if (operation === 'update') {
      next.updated_at = Date.now()
    }

    return { value: next }
  },
  afterRead({ value }) {
    parseIntFields(value, 'created_at', 'updated_at')
    return { value }
  },
})

export const appointofferings = table({
  name: 'appointoffering',
  primaryKey: ['id'],
  columns: {
    id: c.integer(),
    day: bigint(),
    resource_id: c.integer(),
    during: c.text(),
    created_at: bigint(),
    updated_at: bigint(),
  },
  validate({ value }) {
    let issues: Array<{ message: string; path?: Array<string | number> }> = []

    if (value.resource_id === undefined) {
      issues.push({ message: 'resource_id is required.', path: ['resource_id'] })
    }

    if (value.day === undefined) {
      issues.push({ message: 'day is required.', path: ['day'] })
    }

    if (value.during === undefined) {
      issues.push({ message: 'during is required.', path: ['during'] })
    }

    return issues.length > 0 ? { issues } : { value }
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }

    if (operation === 'create') {
      let now = Date.now()
      if (next.created_at === undefined) next.created_at = now
      if (next.updated_at === undefined) next.updated_at = now
    }

    if (operation === 'update') {
      next.updated_at = Date.now()
    }

    return { value: next }
  },
  afterRead({ value }) {
    parseIntFields(value, 'created_at', 'updated_at', 'day', 'resource_id')
    if (typeof value.during === 'object' && value.during !== null) {
      let r = value.during as { lower: unknown; upper: unknown }
      value.during = `[${r.lower},${r.upper})`
    }
    return { value }
  },
})

export const offeringConfigs = table({
  name: 'offering_configs',
  primaryKey: ['id'],
  columns: {
    id: c.integer(),
    resource_id: c.integer(),
    rules: c.json(),
    created_at: bigint(),
    updated_at: bigint(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }

    if (operation === 'create') {
      let now = Date.now()
      if (next.created_at === undefined) next.created_at = now
      if (next.updated_at === undefined) next.updated_at = now
    }

    if (operation === 'update') {
      next.updated_at = Date.now()
    }

    return { value: next }
  },
  afterRead({ value }) {
    parseIntFields(value, 'created_at', 'updated_at', 'resource_id')
    if (typeof value.rules === 'string') {
      try {
        value.rules = JSON.parse(value.rules)
      } catch {
        value.rules = {}
      }
    }
    return { value }
  },
})

export type User = TableRow<typeof users>
export type Client = TableRow<typeof clients>
export type Appointment = TableRow<typeof appointments>
export type AppointType = TableRow<typeof appointtypes>
export type Resource = TableRow<typeof resources>
export const apiTokens = table({
  name: 'api_tokens',
  columns: {
    id: c.integer(),
    user_id: c.integer(),
    token_hash: c.text(),
    created_at: bigint(),
    expires_at: bigint(),
    revoked_at: bigint(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }
    if (operation === 'create' && next.created_at === undefined) {
      next.created_at = Date.now()
    }
    return { value: next }
  },
  afterRead({ value }) {
    parseIntFields(value, 'created_at', 'expires_at', 'revoked_at')
    return { value }
  },
})

export const notifications = table({
  name: 'notifications',
  primaryKey: ['id'],
  columns: {
    id: c.integer(),
    user_id: c.integer(),
    type: c.text(),
    title: c.text(),
    body: c.text(),
    appointment_id: c.integer().nullable(),
    read_at: bigintNullable(),
    created_at: bigint(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }

    if (operation === 'create') {
      let now = Date.now()
      if (next.created_at === undefined) next.created_at = now
      if (next.title === undefined) next.title = ''
      if (next.body === undefined) next.body = ''
    }

    return { value: next }
  },
  afterRead({ value }) {
    parseIntFields(value, 'created_at', 'read_at', 'user_id', 'appointment_id')
    return { value }
  },
})

export type Notification = TableRow<typeof notifications>
export type AppointOffering = TableRow<typeof appointofferings>
export type OfferingConfig = TableRow<typeof offeringConfigs>
