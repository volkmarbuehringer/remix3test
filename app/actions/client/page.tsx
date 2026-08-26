import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import type { Client } from '../../data/schema.ts'
import { ClientGridPage } from './grid-page.tsx'
import { ClientEditPage } from './edit-page.tsx'
import { ClientCreatePage } from './create-page.tsx'

interface ClientPageProps {
  rows: Client[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter?: string
  pageSize: number
  editRow?: Client | null
  creating?: boolean
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

function ClientPage(handle: Handle<ClientPageProps>) {
  return () => {
    let {
      rows,
      offset,
      hasMore,
      prevOffset,
      nextOffset,
      sortColumn,
      sortDirection,
      filter,
      pageSize,
      editRow,
      creating = false,
      formValues,
      fieldErrors,
      formError,
    } = handle.props
    let hasSidebar = editRow || creating

    let gridSection = (
      <div mix={css({ minWidth: 0 })} id="client-grid-section">
        <ClientGridPage
          rows={rows}
          offset={offset}
          hasPrev={prevOffset > 0}
          hasNext={hasMore}
          sortField={sortColumn}
          sortOrder={sortDirection}
          filter={filter}
          pageSize={pageSize}
          editingId={editRow?.id ?? null}
        />
      </div>
    )

    if (hasSidebar) {
      return (
        <div
          mix={css({
            display: 'grid',
            gridTemplateColumns: '1fr 380px',
            gap: '24px',
            alignItems: 'start',
            maxWidth: '1100px',
            margin: '0 auto',
          })}
        >
          {gridSection}
          <div mix={css({ position: 'sticky', top: '1.5rem' })}>
            {editRow ? (
              <ClientEditPage
                row={editRow}
                offset={String(offset)}
                sort={sortColumn}
                order={sortDirection}
                filter={filter ?? ''}
                formValues={formValues}
                fieldErrors={fieldErrors}
              />
            ) : (
              <ClientCreatePage
                offset={String(offset)}
                sort={sortColumn}
                order={sortDirection}
                filter={filter ?? ''}
                formValues={formValues}
                fieldErrors={fieldErrors}
              />
            )}
          </div>
        </div>
      )
    }

    return <div mix={css({ maxWidth: '960px', margin: '0 auto' })}>{gridSection}</div>
  }
}

export { ClientPage }
