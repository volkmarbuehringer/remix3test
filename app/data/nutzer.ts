import { type Database } from 'remix/data-table'

export interface NutzerRow {
  n_id: string
  n_vorname: string | null
  n_name: string | null
  n_email: string | null
  n_verpflichtung: boolean
  l_id: string
  l_login: string
  l_aktiv: boolean
  l_gesperrt: boolean
  l_letzte_login: string | null
}

const PAGE_SIZE = 15

const ORDER_BY_COLUMNS: Record<string, string> = {
  n_vorname: 'n_vorname',
  n_name: 'n_name',
  n_email: 'n_email',
  n_verpflichtung: 'n_verpflichtung',
  l_login: 'l_login',
  l_aktiv: 'l_aktiv',
  l_gesperrt: 'l_gesperrt',
  l_letzte_login: 'l_letzte_login',
}

const SEARCH_COLUMNS = ['n_vorname', 'n_name', 'n_email', 'l_login']

export interface ListNutzerGridOpts {
  offset: number
  column: string
  direction: 'asc' | 'desc'
  filter?: string
  pageSize?: number
}

export async function listNutzerGrid(db: Database, opts: ListNutzerGridOpts) {
  let { offset, column, direction, filter, pageSize = PAGE_SIZE } = opts

  let query = `
    SELECT n_id, n_vorname, n_name, n_email, n_verpflichtung,
           l_id, l_login, l_aktiv, l_gesperrt, l_letzte_login
    FROM nutzer
    INNER JOIN login ON l_id = n_lid
  `

  let params: unknown[] = []
  let paramIndex = 0

  if (filter) {
    paramIndex++
    let esc = filter.slice(0, 200).replace(/[%_\\]/g, '\\$&')
    let searchPattern = `%${esc}%`
    let conditions = SEARCH_COLUMNS.map((col) => `${col} ILIKE $${paramIndex}`)
    query += ` WHERE (${conditions.join(' OR ')})`
    params.push(searchPattern)
  }

  paramIndex++
  query += ` ORDER BY ${ORDER_BY_COLUMNS[column] || 'n_name'} ${direction === 'desc' ? 'DESC' : 'ASC'}, n_id DESC`
  query += ` LIMIT $${paramIndex}`
  params.push(pageSize + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  params.push(offset)

  let result = await db.exec(query, params)
  let rows = (result.rows ?? []) as unknown as NutzerRow[]
  let hasMore = rows.length > pageSize
  if (hasMore) rows.pop()

  return { rows, hasMore }
}

export async function fetchNutzerEditRow(
  db: Database,
  editingRowId: string,
): Promise<NutzerRow | null> {
  let result = await db.exec(
    `SELECT n_id, n_vorname, n_name, n_email, n_verpflichtung,
            l_id, l_login, l_aktiv, l_gesperrt, l_letzte_login
     FROM nutzer INNER JOIN login ON l_id = n_lid
     WHERE n_id = $1`,
    [editingRowId],
  )
  if ((result.rows ?? []).length > 0) {
    return result.rows![0] as unknown as NutzerRow
  }
  return null
}

export interface NutzerCreateData {
  vorname: string
  name: string
  email: string
  verpflichtung: boolean
  login: string
  aktiv: boolean
  gesperrt: boolean
}

export async function createNutzerWithLogin(
  db: Database,
  data: NutzerCreateData,
): Promise<{ nId: number; lId: number }> {
  return await db.transaction(async (tx) => {
    let loginResult = await tx.exec(
      `INSERT INTO login (l_login, l_aktiv, l_gesperrt)
       VALUES ($1, $2, $3)
       RETURNING l_id`,
      [data.login, data.aktiv, data.gesperrt],
    )
    let loginRow = loginResult.rows?.[0] as { l_id: number } | undefined
    if (!loginRow)
      throw new Error('createNutzerWithLogin: INSERT login … RETURNING produced no row')
    let newLId = loginRow.l_id

    let nutzerResult = await tx.exec(
      `INSERT INTO nutzer (n_vorname, n_name, n_email, n_verpflichtung, n_lid)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING n_id`,
      [data.vorname, data.name, data.email, data.verpflichtung, newLId],
    )
    let nutzerRow = nutzerResult.rows?.[0] as { n_id: number } | undefined
    if (!nutzerRow)
      throw new Error('createNutzerWithLogin: INSERT nutzer … RETURNING produced no row')
    let newNId = nutzerRow.n_id

    return { nId: newNId, lId: newLId }
  })
}

export interface NutzerUpdateData {
  vorname: string
  name: string
  email: string
  verpflichtung: boolean
  login: string
  aktiv: boolean
  gesperrt: boolean
  lId: string
}

export async function updateNutzerWithLogin(
  db: Database,
  id: string,
  data: NutzerUpdateData,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.exec(
      `UPDATE nutzer SET n_vorname=$1, n_name=$2, n_email=$3, n_verpflichtung=$4
       WHERE n_id=$5`,
      [data.vorname, data.name, data.email, data.verpflichtung, id],
    )
    await tx.exec(
      `UPDATE login SET l_login=$1, l_aktiv=$2, l_gesperrt=$3
       WHERE l_id=$4`,
      [data.login, data.aktiv, data.gesperrt, data.lId],
    )
  })
}

export async function deleteNutzer(
  db: Database,
  id: string,
): Promise<{ deletedLid: number } | null> {
  return await db.transaction(async (tx) => {
    let nutzerResult = await tx.exec(`DELETE FROM nutzer WHERE n_id=$1 RETURNING n_lid`, [id])
    if ((nutzerResult.rows ?? []).length === 0) {
      return null
    }
    let deleteRow = nutzerResult.rows?.[0] as { n_lid: number } | undefined
    if (!deleteRow) throw new Error('deleteNutzer: DELETE … RETURNING produced no row')
    let nLid = deleteRow.n_lid

    await tx.exec(`DELETE FROM login WHERE l_id=$1`, [nLid])

    return { deletedLid: nLid }
  })
}

export interface NutzerWithLogin {
  nId: string
  nName: string | null
  nVorname: string | null
  lId: number
}

export async function getNutzerWithLogin(
  db: Database,
  id: string,
): Promise<NutzerWithLogin | null> {
  let result = await db.exec(
    `SELECT n.n_id, n.n_name, n.n_vorname, l.l_id
     FROM nutzer n JOIN login l ON n.n_lid = l.l_id
     WHERE n.n_id = $1`,
    [id],
  )
  if ((result.rows ?? []).length === 0) return null
  let row = result.rows![0] as {
    n_id: string
    n_name: string | null
    n_vorname: string | null
    l_id: number
  }
  return {
    nId: row.n_id,
    nName: row.n_name,
    nVorname: row.n_vorname,
    lId: row.l_id,
  }
}

export async function updateNutzerPassword(
  db: Database,
  lId: number,
  hashedPassword: string,
): Promise<void> {
  await db.exec(`UPDATE login SET l_password=$1, l_tv = COALESCE(l_tv, 0) + 1 WHERE l_id=$2`, [
    hashedPassword,
    lId,
  ])
}

export async function toggleNutzerLock(
  db: Database,
  id: string,
  locked: boolean,
): Promise<boolean> {
  let result = await db.exec(
    `UPDATE login SET l_gesperrt=$1
     FROM nutzer WHERE nutzer.n_lid = login.l_id AND nutzer.n_id = $2`,
    [locked, id],
  )
  return (result.affectedRows ?? 0) > 0
}

export async function toggleNutzerActive(
  db: Database,
  id: string,
  active: boolean,
): Promise<boolean> {
  let result = await db.exec(
    `UPDATE login SET l_aktiv=$1
     FROM nutzer WHERE nutzer.n_lid = login.l_id AND nutzer.n_id = $2`,
    [active, id],
  )
  return (result.affectedRows ?? 0) > 0
}
