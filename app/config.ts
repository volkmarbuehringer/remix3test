import { z } from 'zod/v4'

/**
 * Central, validated process-environment configuration.
 *
 * Read the environment through these helpers instead of `process.env` directly:
 * parsing and validation live in one place and every value is typed. The helper
 * functions read on each call, so tests that set a variable before the read keep
 * working; the `nodeEnv` flags are resolved once at module load.
 */

const NODE_ENV = z.enum(['development', 'test', 'production'])
export type NodeEnv = z.infer<typeof NODE_ENV>

/** The validated runtime environment; an unrecognised value falls back to development. */
export const nodeEnv: NodeEnv = NODE_ENV.catch('development').parse(process.env.NODE_ENV)
export const isDevelopment = nodeEnv === 'development'
export const isTest = nodeEnv === 'test'
export const isProduction = nodeEnv === 'production'

/**
 * NODE_ENV read at call time, for code that must observe runtime overrides
 * (tests) or make a decision at request time rather than at module load.
 */
export function currentNodeEnv(): NodeEnv {
  return NODE_ENV.catch('development').parse(process.env.NODE_ENV)
}

/** Whether the current (call-time) environment is production. */
export function isProductionEnv(): boolean {
  return currentNodeEnv() === 'production'
}

/** A required, non-empty string env var. Throws a descriptive error when unset. */
export function requireEnv(name: string, hint?: string): string {
  let value = process.env[name]?.trim()
  if (!value) {
    throw new Error(hint ?? `${name} environment variable is required. Set it in .env`)
  }
  return value
}

/** A trimmed string env var, or `undefined` when unset or blank. */
export function envString(name: string): string | undefined {
  let value = process.env[name]?.trim()
  return value ? value : undefined
}

/**
 * A number env var that must be greater than zero. Falls back when the value is
 * unset, non-numeric, or not positive — matching the historical
 * `Number(x) || fallback` / `value > 0` semantics.
 */
export function envPositiveNumber(name: string, fallback: number): number {
  let value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/** Like {@link envPositiveNumber}, but returns `undefined` instead of a fallback. */
export function envPositiveNumberOrUndefined(name: string): number | undefined {
  let value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : undefined
}

/** A `1/true/yes/on` boolean env var; anything else (or unset) yields `fallback`. */
export function envBool(name: string, fallback = false): boolean {
  let value = process.env[name]?.trim().toLowerCase()
  if (!value) return fallback
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}
