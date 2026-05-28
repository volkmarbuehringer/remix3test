import type { Handle } from 'remix/ui'
import { Frame } from 'remix/ui'
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
    } = handle.props
    let hasSidebar = editRow || creating

    let gridSection = (
      <div style="min-width:0" id="client-grid-section">
        <Frame name={frames.clientGrid} src={frameSrc} />
      </div>
    )

    if (hasSidebar) {
      return (
        <div style="display:grid;grid-template-columns:1fr 380px;gap:24px;align-items:start;max-width:1100px;margin:0 auto">
          {gridSection}
          <div style="position:sticky;top:1.5rem">
            {editRow ? (
              <ClientEditPage
                row={editRow}
                offset={editingOffset}
                sort={editingSort}
                order={editingOrder}
                filter={editingFilter}
              />
            ) : (
              <ClientCreatePage
                offset={editingOffset}
                sort={editingSort}
                order={editingOrder}
                filter={editingFilter}
              />
            )}
          </div>
        </div>
      )
    }

    return (
      <div style="max-width:960px;margin:0 auto">
        {gridSection}
      </div>
    )
  }
}

export { ClientPage }
