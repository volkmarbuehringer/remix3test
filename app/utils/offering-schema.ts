import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import * as coerce from 'remix/data-schema/coerce'
import { parseIsoDateUtc } from './date-utils.ts'
import { gridQueryFields } from './grid-params.ts'

export const OFFERING_FORM_KEYS = ['resource_id', 'day', 'start_min', 'end_min'] as const

export const offeringSaveSchema = f.object({
  resource_id: f.field(
    coerce.number().refine((n) => n > 0 && Number.isFinite(n), 'ist erforderlich.'),
  ),
  // Round-trip parse, not a shape-only regex: non-calendar dates like
  // 2026-02-31 would otherwise roll over to another day and be saved there.
  day: f.field(
    s
      .string()
      .refine((v) => parseIsoDateUtc(v) !== null, 'Gültiges Datum erforderlich (YYYY-MM-DD).'),
  ),
  start_min: f.field(
    coerce.number().refine((n) => n >= 0 && n <= 1380 && n % 60 === 0, 'ist ungültig.'),
  ),
  end_min: f.field(
    coerce.number().refine((n) => n >= 60 && n <= 1440 && n % 60 === 0, 'ist ungültig.'),
  ),
  ...gridQueryFields,
})
