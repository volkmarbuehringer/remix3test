import type { Handle } from 'remix/ui'
import { css, Frame } from 'remix/ui'
import { frames } from '../../routes.ts'
import type { Client } from '../../data/schema.ts'
import { ClientEditPage } from './edit-page.tsx'
import { ClientCreatePage } from './create-page.tsx'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ClientPageProps {
  frameSrc: string
  editRow?: Client | null
  creating?: boolean
  editingOffset?: string
  editingSort?: string
  editingOrder?: string
  editingFilter?: string
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
}

function ClientPage(handle: Handle<ClientPageProps>) {
  return () => {
    let {
      frameSrc,
      editRow,
      creating = false,
      editingOffset = '',
      editingSort = '',
      editingOrder = '',
      editingFilter = '',
      formValues,
      fieldErrors,
    } = handle.props
    let hasSidebar = editRow || creating

    let gridSection = (
      <div mix={css({ minWidth: 0 })} id="client-grid-section">
        <Frame name={frames.clientGrid} src={frameSrc} />
      </div>
    )

    if (hasSidebar) {
      return (
        <div mix={css({ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start', maxWidth: '1100px', margin: '0 auto' })}>
          {gridSection}
          <div mix={css({ position: 'sticky', top: '1.5rem' })}>
            {editRow ? (
              <ClientEditPage
                row={editRow}
                offset={editingOffset}
                sort={editingSort}
                order={editingOrder}
                filter={editingFilter}
                formValues={formValues}
                fieldErrors={fieldErrors}
              />
            ) : (
              <ClientCreatePage
                offset={editingOffset}
                sort={editingSort}
                order={editingOrder}
                filter={editingFilter}
                formValues={formValues}
                fieldErrors={fieldErrors}
              />
            )}
          </div>
        </div>
      )
    }

    return (
      <div mix={css({ maxWidth: '960px', margin: '0 auto' })}>
        {gridSection}
      </div>
    )
  }
}

export { ClientPage }
