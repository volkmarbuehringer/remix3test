import { clientEntry, css } from 'remix/component'

import {
  confirmAndSubmitRowForm,
  createRowContextMenu,
  navigateGridParam,
  submitRowForm,
  type GridNavigation,
} from '../../../ui/row-context-menu.tsx'
import { Glyph } from '../../../ui/theme/glyph/glyph.tsx'
import { MenuItem } from '../../../ui/theme/menu/index.tsx'
import { Separator } from '../../../ui/theme/separator/separator.ts'
import { theme } from '../../../ui/theme/theme.ts'

const navigation: GridNavigation = {
  stateElementId: 'clients-grid-state',
  fallbackBaseHref: '/admin/clients',
  defaultSort: 'id',
}

/**
 * Right-click menu for client-grid rows. The activate/deactivate item depends on
 * the row's `data-status` attribute, so the menu re-renders on capture.
 */
export const ClientsContextMenu = clientEntry(
  import.meta.url + '#ClientsContextMenu',
  createRowContextMenu({
    label: 'Kundenaktionen',
    tableSelector: '[data-clients-table]',
    reactive: true,
    items: (target) => {
      let isActive = target?.row.getAttribute('data-status') === 'Active'
      return (
        <>
          <MenuItem name="edit">
            <Glyph name="edit" width={14} height={14} /> Bearbeiten
          </MenuItem>
          <Separator />
          {isActive ? (
            <MenuItem name="deactivate">Deaktivieren</MenuItem>
          ) : (
            <MenuItem name="activate">Aktivieren</MenuItem>
          )}
          <Separator />
          <MenuItem name="delete" mix={css({ color: theme.colors.action.danger.background })}>
            <Glyph name="trash" width={14} height={14} /> Löschen
          </MenuItem>
        </>
      )
    },
    onSelect: (name, target, handle) => {
      switch (name) {
        case 'edit':
          navigateGridParam(handle, navigation, 'editing', target.rowId)
          break
        case 'activate':
        case 'deactivate':
          submitRowForm(target.rowId, 'data-toggle-form')
          break
        case 'delete':
          confirmAndSubmitRowForm(target.rowId, 'Wirklich löschen?')
          break
      }
    },
  }),
)
