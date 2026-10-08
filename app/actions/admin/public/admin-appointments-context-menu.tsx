import { clientEntry, css } from 'remix/component'

import {
  confirmFromFormAndSubmit,
  createRowContextMenu,
  navigateGridParam,
  type GridNavigation,
} from '../../../ui/row-context-menu.tsx'
import { Glyph } from '../../../ui/theme/glyph/glyph.tsx'
import { MenuItem } from '../../../ui/theme/menu/index.tsx'
import { Separator } from '../../../ui/theme/separator/separator.ts'
import { theme } from '../../../ui/theme/theme.ts'

const navigation: GridNavigation = {
  stateElementId: 'appointments-grid-state',
  fallbackBaseHref: '/verwaltung/appointments',
  defaultSort: 'a.date',
}

/**
 * Right-click menu for admin appointment rows. The delete confirmation message
 * comes from the row form's own `data-confirm`.
 */
export const AdminAppointmentsContextMenu = clientEntry(
  import.meta.url + '#AdminAppointmentsContextMenu',
  createRowContextMenu({
    label: 'Terminaktionen',
    tableSelector: '[data-appointments-table]',
    items: () => (
      <>
        <MenuItem name="edit">
          <Glyph name="edit" width={14} height={14} /> Bearbeiten
        </MenuItem>
        <Separator />
        <MenuItem name="delete" mix={css({ color: theme.colors.action.danger.background })}>
          <Glyph name="trash" width={14} height={14} /> Löschen
        </MenuItem>
      </>
    ),
    onSelect: (name, target, handle) => {
      if (name === 'edit') {
        navigateGridParam(handle, navigation, 'editing', target.rowId)
      } else if (name === 'delete') {
        confirmFromFormAndSubmit(target.rowId, 'Wirklich löschen?')
      }
    },
  }),
)
