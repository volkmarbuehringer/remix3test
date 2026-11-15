import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { getTableColumnDefinitions, getTableName } from 'remix/data-table'

import { db } from '../db.ts'
import {
  apiTokens,
  appointments,
  appointofferings,
  appointtypes,
  clients,
  lists,
  messages,
  offeringConfigs,
  resources,
  users,
} from './schema.ts'

/**
 * The guide's §"Create the tables with SQL" requires the `table()` metadata to
 * stay aligned with the resulting SQL schema. This guard catches the drift that
 * typechecking cannot: a column added/removed in a migration, or a nullability
 * change that leaves `TableRow` lying about the wire value.
 */
const tables = [
  users,
  messages,
  clients,
  lists,
  appointments,
  appointtypes,
  resources,
  appointofferings,
  offeringConfigs,
  apiTokens,
]

interface ColumnRow {
  table_name: string
  column_name: string
  is_nullable: 'YES' | 'NO'
  is_generated: 'ALWAYS' | 'NEVER'
}

describe('data-table metadata vs SQL schema', () => {
  it('keeps every table() column, and its nullability, aligned with information_schema', async () => {
    let result = await db.exec(
      `SELECT table_name, column_name, is_nullable, is_generated
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`,
    )
    let rows = (result.rows ?? []) as unknown as ColumnRow[]
    let sqlColumns = new Map<string, Map<string, ColumnRow>>()
    for (let row of rows) {
      let columns = sqlColumns.get(row.table_name) ?? new Map<string, ColumnRow>()
      columns.set(row.column_name, row)
      sqlColumns.set(row.table_name, columns)
    }

    for (let table of tables) {
      let tableName = getTableName(table)
      let columns = sqlColumns.get(tableName)
      assert.ok(columns, `missing SQL table "${tableName}"`)

      let definitions = getTableColumnDefinitions(table)
      for (let [columnName, definition] of Object.entries(definitions)) {
        let sqlColumn = columns.get(columnName)
        assert.ok(sqlColumn, `table() column "${tableName}.${columnName}" is missing in SQL`)

        // PostgreSQL reports generated columns as nullable even when the
        // generation expression cannot return NULL (appointments.start_min/
        // end_min derive from a NOT NULL `during`), so nullability is not a
        // meaningful comparison there.
        if (sqlColumn.is_generated === 'ALWAYS') continue

        let metadataNullable = Boolean((definition as { nullable?: boolean }).nullable)
        assert.equal(
          metadataNullable,
          sqlColumn.is_nullable === 'YES',
          `"${tableName}.${columnName}" nullability drifted from SQL`,
        )
      }

      for (let columnName of columns.keys()) {
        assert.ok(
          columnName in definitions,
          `SQL column "${tableName}.${columnName}" is missing from table() metadata`,
        )
      }
    }
  })
})
