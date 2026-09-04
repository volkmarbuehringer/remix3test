import { type Database } from 'remix/data-table'

import { appointtypes, type AppointType } from './schema.ts'

interface AppointTypeInput {
  title: string
}

interface AppointTypeUpdate {
  title?: string | undefined
}

export class AppointTypeError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function listAppointTypes(db: Database, userId: number): Promise<AppointType[]> {
  return await db.query(appointtypes).where({ user_id: userId }).orderBy('title', 'asc').all()
}

export async function createAppointType(
  db: Database,
  userId: number,
  input: AppointTypeInput,
): Promise<AppointType> {
  let result = await db.create(
    appointtypes,
    {
      user_id: userId,
      title: input.title.trim(),
    },
    { returnRow: true },
  )
  return result as AppointType
}

export async function updateAppointType(
  db: Database,
  userId: number,
  typeId: number,
  input: AppointTypeUpdate,
): Promise<AppointType> {
  let existing = await db.findOne(appointtypes, {
    where: { id: typeId, user_id: userId },
  })
  if (!existing) {
    throw new AppointTypeError('Appointment type not found.', 404)
  }

  let update: Record<string, unknown> = {}
  if (input.title !== undefined) update.title = input.title.trim()

  let result = (await db.query(appointtypes).where({ id: typeId, user_id: userId }).update(update, {
    returning: '*',
  })) as { rows: AppointType[] }
  if (!result.rows[0]) {
    throw new AppointTypeError('Appointment type not found.', 404)
  }
  return result.rows[0]
}

export async function deleteAppointType(
  db: Database,
  userId: number,
  typeId: number,
): Promise<void> {
  let existing = await db.findOne(appointtypes, {
    where: { id: typeId, user_id: userId },
  })
  if (!existing) {
    throw new AppointTypeError('Appointment type not found.', 404)
  }

  await db.query(appointtypes).where({ id: typeId, user_id: userId }).delete()
}
