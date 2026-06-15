import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import * as coerce from 'remix/data-schema/coerce'

export const APPOINTMENT_FORM_KEYS = [
  'resource_id',
  'user_id',
  'title',
  'date',
  'start_min',
  'end_min',
] as const
export const APPOINTMENTS_NEW_FORM_KEYS = [
  'resource_id',
  'title',
  'date',
  'start_min',
  'day_start',
] as const

export const appointmentSaveSchema = f.object({
  resource_id: f.field(
    coerce.number().refine((n) => n > 0 && Number.isFinite(n), 'ist erforderlich.'),
  ),
  user_id: f.field(coerce.number().refine((n) => n > 0 && Number.isFinite(n), 'ist erforderlich.')),
  title: f.field(
    s.defaulted(
      s
        .string()
        .transform((v) => v.trim())
        .refine((v) => v.length > 0, 'Titel ist erforderlich.'),
      '',
    ),
  ),
  date: f.field(
    s
      .string()
      .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), 'Gültiges Datum erforderlich (YYYY-MM-DD).'),
  ),
  start_min: f.field(
    coerce.number().refine((n) => n >= 0 && n <= 1380 && n % 15 === 0, 'ist ungültig.'),
  ),
  end_min: f.field(
    coerce.number().refine((n) => n >= 60 && n <= 1440 && n % 15 === 0, 'ist ungültig.'),
  ),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
  _period: f.field(s.defaulted(s.string(), '')),
  _status: f.field(s.defaulted(s.string(), '')),
})

export const appointmentsNewSaveSchema = f.object({
  resource_id: f.field(
    coerce.number().refine((n) => n > 0 && Number.isFinite(n), 'ist erforderlich.'),
  ),
  title: f.field(
    s.defaulted(
      s.string().transform((v) => v.trim()),
      '',
    ),
  ),
  date: f.field(
    s
      .string()
      .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), 'Gültiges Datum erforderlich (YYYY-MM-DD).'),
  ),
  start_min: f.field(
    coerce.number().refine((n) => n >= 0 && n <= 1380 && n % 15 === 0, 'ist ungültig.'),
  ),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
  _period: f.field(s.defaulted(s.string(), '')),
  _status: f.field(s.defaulted(s.string(), '')),
})
