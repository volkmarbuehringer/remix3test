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
  stateElementId: 'offerings-grid-state',
  fallbackBaseHref: '/verwaltung/offerings',
  defaultSort: 'ao.id',
}

/**
 * Right-click menu for admin offering rows. "Konfiguration" edits the offering's
 * assigned resource (captured from the row's `data-resource-id`).
 */
export const AdminOfferingsContextMenu = clientEntry(
  import.meta.url + '#AdminOfferingsContextMenu',
  createRowContextMenu({
    label: 'Angebotsaktionen',
    tableSelector: '[data-offerings-table]',
    items: () => (
      <>
        <MenuItem name="edit">
          <Glyph name="edit" width={14} height={14} /> Bearbeiten
        </MenuItem>
        <MenuItem name="config">
          <Glyph name="cog" width={14} height={14} /> Konfiguration
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
      } else if (name === 'config') {
        let resourceId = target.row.dataset.resourceId
        if (resourceId) navigateGridParam(handle, navigation, 'config', resourceId)
      } else if (name === 'delete') {
        confirmAndSubmitRowForm(target.rowId, 'Wirklich löschen?')
      }
    },
  }),
)
