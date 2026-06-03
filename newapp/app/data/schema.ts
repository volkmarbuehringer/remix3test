import { column as c, table } from 'remix/data-table'
import type { TableRow } from 'remix/data-table'
import { parseIntFields } from '../utils/schema-utils.ts'

export const users = table({
  name: 'users',
  columns: {
    id: c.integer(),
    email: c.text(),
    password_hash: c.text(),
    name: c.text(),
    role: c.enum(['customer', 'admin']),
    created_at: c.integer(),
    updated_at: c.integer(),
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
    parseIntFields(value, 'created_at', 'updated_at')
    return { value }
  },
})

export const chatlog = table({
  name: 'chatlog',
  primaryKey: ['id'],
  columns: {
    id: c.text(),
    conversation: c.json(),
    created_at: c.integer(),
    updated_at: c.integer(),
  },
  beforeWrite({ value }) {
    if (Array.isArray(value.conversation)) {
      value.conversation = JSON.stringify(value.conversation)
    }
    return { value }
  },
  afterRead({ value }) {
    parseIntFields(value, 'created_at', 'updated_at')
    if (typeof value.conversation === 'string') {
      try {
        value.conversation = JSON.parse(value.conversation)
      } catch {
        value.conversation = []
      }
    }
    return { value }
  },
})

export const workflowRuns = table({
  name: 'workflow_runs',
  primaryKey: ['id'],
  columns: {
    id: c.text(),
    workflow_id: c.text(),
    status: c.text(),
    params: c.text(),
    steps: c.text(),
    result: c.text(),
    error: c.text(),
    created_at: c.integer(),
    completed_at: c.integer(),
    created_by: c.integer(),
    parent_run_id: c.text(),
    chain_depth: c.integer(),
  },
  beforeWrite({ value }) {
    let next = { ...value }
    if (next.status === undefined) next.status = 'pending'
    if (next.params === undefined) next.params = '{}'
    if (next.steps === undefined) next.steps = '[]'
    if (next.chain_depth === undefined) next.chain_depth = 0
    if (next.created_at === undefined) next.created_at = Date.now()
    return { value: next }
  },
  afterRead({ value }) {
    parseIntFields(value, 'created_at', 'completed_at')
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
    created_at: c.integer(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }
    if (operation === 'create' && next.created_at === undefined) {
      next.created_at = Date.now()
    }
    return { value }
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
    registered: c.integer(),
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
    list: c.json(),
    description: c.text(),
    created_at: c.integer(),
    updated_at: c.integer(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }

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
    parseIntFields(value, 'created_at', 'updated_at')
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
    date: c.integer(),
    created_at: c.integer(),
    updated_at: c.integer(),
    during: c.text(),
    start_min: c.integer(),
    end_min: c.integer(),
  },
  validate({ operation, value }) {
    let issues: Array<{ message: string; path?: Array<string | number> }> = []

    if (operation === 'create' && value.resource_id === undefined) {
      issues.push({
        message: 'resource_id is required.',
        path: ['resource_id'],
      })
    }

    // If either time field is provided, both must be provided together
    if (
      (value.start_min === undefined) !== (value.end_min === undefined)
    ) {
      issues.push({
        message: 'Both start_min and end_min are required for time changes.',
        path: ['start_min'],
      })
    }

    // start_min must be less than end_min
    if (
      typeof value.start_min === 'number' &&
      typeof value.end_min === 'number' &&
      value.start_min >= value.end_min
    ) {
      issues.push({
        message: 'start_min must be less than end_min.',
        path: ['start_min'],
      })
    }

    // Time values must be within the day (0–1440)
    if (typeof value.start_min === 'number' && (value.start_min < 0 || value.start_min > 1440)) {
      issues.push({
        message: 'start_min must be between 0 and 1440.',
        path: ['start_min'],
      })
    }
    if (typeof value.end_min === 'number' && (value.end_min < 0 || value.end_min > 1440)) {
      issues.push({
        message: 'end_min must be between 0 and 1440.',
        path: ['end_min'],
      })
    }

    return issues.length > 0 ? { issues } : { value }
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }

    // Convert start_min/end_min to during range string;
    // strip computed columns (start_min/end_min are GENERATED ALWAYS, cannot be written)
    if (next.start_min !== undefined && next.end_min !== undefined) {
      next.during = `[${next.start_min},${next.end_min})`
    }
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
    created_at: c.integer(),
    updated_at: c.integer(),
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
    description: c.text(),
    created_at: c.integer(),
    updated_at: c.integer(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }

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
    day: c.integer(),
    resource_id: c.integer(),
    during: c.text(),
    created_at: c.integer(),
    updated_at: c.integer(),
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
    created_at: c.integer(),
    updated_at: c.integer(),
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
      try { value.rules = JSON.parse(value.rules) } catch { value.rules = {} }
    }
    return { value }
  },
})

export const auditLogs = table({
  name: 'audit_logs',
  primaryKey: ['id'],
  columns: {
    id: c.integer(),
    admin_user_id: c.integer(),
    admin_email: c.text(),
    action_type: c.text(),
    target_type: c.text(),
    target_id: c.text(),
    details: c.json(),
    created_at: c.integer(),
  },
  afterRead({ value }) {
    parseIntFields(value, 'admin_user_id', 'created_at')
    if (typeof value.details === 'string') {
      try { value.details = JSON.parse(value.details) } catch { value.details = null }
    }
    return { value }
  },
})

export type User = TableRow<typeof users>
export type Client = TableRow<typeof clients>
export type Appointment = TableRow<typeof appointments>
export type AppointType = TableRow<typeof appointtypes>
export type Resource = TableRow<typeof resources>
export type AppointOffering = TableRow<typeof appointofferings>
export type OfferingConfig = TableRow<typeof offeringConfigs>
