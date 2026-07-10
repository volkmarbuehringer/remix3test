import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase, pool } from './setup.ts'
import {
  listNutzerGrid,
  fetchNutzerEditRow,
  createNutzerWithLogin,
  updateNutzerWithLogin,
  deleteNutzer,
  getNutzerWithLogin,
  updateNutzerPassword,
  toggleNutzerLock,
  toggleNutzerActive,
} from './nutzer.ts'

describe('nutzer', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query('DELETE FROM nutzer WHERE n_email LIKE $1', ['test-nutzer%@example.com'])
    await pool.query(
      `DELETE FROM login WHERE l_id IN (
        SELECT l_id FROM login WHERE l_login LIKE 'test-nutzer-%'
      )`,
    )
  })

  it('createNutzerWithLogin creates nutzer and login records', async () => {
    let { nId, lId } = await createNutzerWithLogin(db, {
      vorname: 'Test',
      name: 'Nutzer',
      email: 'test-nutzer-a@example.com',
      verpflichtung: false,
      login: 'test-nutzer-a',
      aktiv: true,
      gesperrt: false,
    })
    assert.ok(typeof nId === 'number')
    assert.ok(typeof lId === 'number')
  })

  it('getNutzerWithLogin returns nutzer+login for existing id', async () => {
    let { nId } = await createNutzerWithLogin(db, {
      vorname: 'Fetch',
      name: 'Test',
      email: 'test-nutzer-b@example.com',
      verpflichtung: false,
      login: 'test-nutzer-b',
      aktiv: true,
      gesperrt: false,
    })
    let row = await getNutzerWithLogin(db, String(nId))
    assert.ok(row !== null)
    assert.equal(row!.nName, 'Test')
    assert.equal(row!.nVorname, 'Fetch')
  })

  it('getNutzerWithLogin returns null for nonexistent id', async () => {
    let row = await getNutzerWithLogin(db, '-1')
    assert.equal(row, null)
  })

  it('fetchNutzerEditRow returns full row for existing id', async () => {
    let { nId } = await createNutzerWithLogin(db, {
      vorname: 'Edit',
      name: 'Row',
      email: 'test-nutzer-c@example.com',
      verpflichtung: true,
      login: 'test-nutzer-c',
      aktiv: true,
      gesperrt: false,
    })
    let row = await fetchNutzerEditRow(db, String(nId))
    assert.ok(row !== null)
    assert.equal(row!.n_vorname, 'Edit')
    assert.equal(row!.n_verpflichtung, true)
  })

  it('fetchNutzerEditRow returns null for nonexistent id', async () => {
    let row = await fetchNutzerEditRow(db, '-1')
    assert.equal(row, null)
  })

  it('updateNutzerWithLogin updates both nutzer and login', async () => {
    let { nId, lId } = await createNutzerWithLogin(db, {
      vorname: 'Before',
      name: 'Update',
      email: 'test-nutzer-d@example.com',
      verpflichtung: false,
      login: 'test-nutzer-d',
      aktiv: true,
      gesperrt: false,
    })
    await updateNutzerWithLogin(db, String(nId), {
      vorname: 'After',
      name: 'Updated',
      email: 'test-nutzer-d@example.com',
      verpflichtung: true,
      login: 'test-nutzer-d-updated',
      aktiv: false,
      gesperrt: true,
      lId: String(lId),
    })
    let row = await fetchNutzerEditRow(db, String(nId))
    assert.equal(row!.n_vorname, 'After')
    assert.equal(row!.n_verpflichtung, true)
  })

  it('deleteNutzer deletes nutzer and login, returns lid', async () => {
    let { nId } = await createNutzerWithLogin(db, {
      vorname: 'Delete',
      name: 'Me',
      email: 'test-nutzer-e@example.com',
      verpflichtung: false,
      login: 'test-nutzer-e',
      aktiv: true,
      gesperrt: false,
    })
    let result = await deleteNutzer(db, String(nId))
    assert.ok(result !== null)
    assert.ok(typeof result!.deletedLid === 'number')

    let row = await getNutzerWithLogin(db, String(nId))
    assert.equal(row, null)
  })

  it('deleteNutzer returns null for nonexistent id', async () => {
    let result = await deleteNutzer(db, '-1')
    assert.equal(result, null)
  })

  it('updateNutzerPassword updates password hash', async () => {
    let { nId, lId } = await createNutzerWithLogin(db, {
      vorname: 'Password',
      name: 'Test',
      email: 'test-nutzer-f@example.com',
      verpflichtung: false,
      login: 'test-nutzer-f',
      aktiv: true,
      gesperrt: false,
    })
    await updateNutzerPassword(db, lId, 'new-hashed-password')

    let loginResult = await pool.query('SELECT l_password FROM login WHERE l_id = $1', [lId])
    assert.equal(loginResult.rows[0].l_password, 'new-hashed-password')
  })

  it('toggleNutzerLock sets locked state', async () => {
    let { nId } = await createNutzerWithLogin(db, {
      vorname: 'Lock',
      name: 'Test',
      email: 'test-nutzer-g@example.com',
      verpflichtung: false,
      login: 'test-nutzer-g',
      aktiv: true,
      gesperrt: false,
    })
    let toggled = await toggleNutzerLock(db, String(nId), true)
    assert.equal(toggled, true)

    let row = await fetchNutzerEditRow(db, String(nId))
    assert.equal(row!.l_gesperrt, true)

    let toggledBack = await toggleNutzerLock(db, String(nId), false)
    assert.equal(toggledBack, true)
  })

  it('toggleNutzerLock returns false for nonexistent id', async () => {
    let toggled = await toggleNutzerLock(db, '-1', true)
    assert.equal(toggled, false)
  })

  it('toggleNutzerActive sets active state', async () => {
    let { nId } = await createNutzerWithLogin(db, {
      vorname: 'Active',
      name: 'Test',
      email: 'test-nutzer-h@example.com',
      verpflichtung: false,
      login: 'test-nutzer-h',
      aktiv: true,
      gesperrt: false,
    })
    let toggled = await toggleNutzerActive(db, String(nId), false)
    assert.equal(toggled, true)

    let row = await fetchNutzerEditRow(db, String(nId))
    assert.equal(row!.l_aktiv, false)
  })

  it('toggleNutzerActive returns false for nonexistent id', async () => {
    let toggled = await toggleNutzerActive(db, '-1', true)
    assert.equal(toggled, false)
  })

  it('listNutzerGrid returns paginated nutzer rows', async () => {
    for (let i = 0; i < 3; i++) {
      await createNutzerWithLogin(db, {
        vorname: `Grid${i}`,
        name: `Test${i}`,
        email: `test-nutzer-grid-${i}@example.com`,
        verpflichtung: false,
        login: `test-nutzer-grid-${i}`,
        aktiv: true,
        gesperrt: false,
      })
    }
    let result = await listNutzerGrid(db, {
      offset: 0,
      column: 'n_name',
      direction: 'asc',
    })
    assert.ok(result.rows.length >= 3)
    assert.ok(result.rows.some((r) => r.n_email && r.n_email.includes('test-nutzer-grid')))
  })

  it('listNutzerGrid respects filter', async () => {
    await createNutzerWithLogin(db, {
      vorname: 'Filter',
      name: 'Target',
      email: 'test-nutzer-filter@example.com',
      verpflichtung: false,
      login: 'test-nutzer-filter',
      aktiv: true,
      gesperrt: false,
    })
    let result = await listNutzerGrid(db, {
      offset: 0,
      column: 'n_name',
      direction: 'asc',
      filter: 'Target',
    })
    assert.ok(result.rows.length >= 1)
  })

  it('listNutzerGrid returns empty for nonexistent filter', async () => {
    let result = await listNutzerGrid(db, {
      offset: 0,
      column: 'n_name',
      direction: 'asc',
      filter: 'zzzzzzzzzzz',
    })
    assert.equal(result.rows.length, 0)
  })
})
