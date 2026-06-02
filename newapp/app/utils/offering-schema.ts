import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import * as coerce from 'remix/data-schema/coerce'

export const OFFERING_FORM_KEYS = ['resource_id', 'day', 'start_min', 'end_min'] as const

export const offeringSaveSchema = f.object({
  resource_id: f.field(
    coerce.number().refine((n) => n > 0 && Number.isFinite(n), 'ist erforderlich.'),
  ),
  day: f.field(
    s.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), 'Gültiges Datum erforderlich (YYYY-MM-DD).'),
  ),
  start_min: f.field(
    coerce.number().refine((n) => n >= 0 && n <= 1380 && n % 60 === 0, 'ist ungültig.'),
  ),
  end_min: f.field(
    coerce.number().refine((n) => n >= 60 && n <= 1440 && n % 60 === 0, 'ist ungültig.'),
  ),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})
