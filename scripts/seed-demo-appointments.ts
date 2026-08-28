// Seed a few future demo appointments for the customer so the /appointments/new
// data table has rows to validate its mobile card layout. Run:
//   node --env-file-if-exists=.env --import remix/node-tsx scripts/seed-demo-appointments.ts
import { db, closeAppDatabase } from '../app/db.ts'
import { users, resources } from '../app/data/schema.ts'
import { createAppointmentRecord } from '../app/data/appointments.ts'

async function main() {
  let customer = await db.findOne(users, { where: { email: 'user@newapp.com' } })
  let res = (await db.query(resources).orderBy('id', 'asc').all())[0]
  if (!customer || !res) {
    console.error('No customer/resource to seed against')
    process.exit(1)
  }
  let now = Date.now()
  let day = new Date(now)
  day.setUTCDate(day.getUTCDate() + 3)
  let dayMs = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())
  let rows = [
    { title: 'Beratungsgespräch', start: 600, end: 660, offsetDays: 3 },
    { title: '', start: 720, end: 780, offsetDays: 3 },
    { title: 'Folgetermin', start: 840, end: 900, offsetDays: 4 },
  ]
  for (let r of rows) {
    let d = new Date(dayMs)
    d.setUTCDate(d.getUTCDate() + (r.offsetDays - 3))
    let id = await createAppointmentRecord(db, {
      userId: customer.id,
      resourceId: res.id,
      title: r.title,
      dayMs: d.getTime(),
      during: `[${r.start},${r.end})`,
      now,
    })
    console.log(`Seeded appointment id=${id} title="${r.title}"`)
  }
  await closeAppDatabase()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
