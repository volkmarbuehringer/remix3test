import { clientEntry, css } from 'remix/component'

import {
  confirmAndSubmitRowForm,
  createRowContextMenu,
  navigateGridParam,
  type GridNavigation,
} from '../../../ui/row-context-menu.tsx'
import { Glyph } from '../../../ui/theme/glyph/glyph.tsx'
import { MenuItem } from '../../../ui/theme/menu/index.tsx'
import { Separator } from '../../../ui/theme/separator/separator.ts'
import { theme } from '../../../ui/theme/theme.ts'

const navigation: GridNavigation = {
  stateElementId: 'offering-configs-grid-state',
  fallbackBaseHref: '/verwaltung/offering-configs',
  defaultSort: 'resource_description',
}

/** Right-click menu for admin offering-config rows. */
export const AdminOfferingConfigsContextMenu = clientEntry(
  import.meta.url + '#AdminOfferingConfigsContextMenu',
  createRowContextMenu({
    label: 'Konfigurationsaktionen',
    tableSelector: '[data-offering-configs-table]',
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
        confirmAndSubmitRowForm(target.rowId, 'Wirklich löschen?')
      }
    },
  }),
)
