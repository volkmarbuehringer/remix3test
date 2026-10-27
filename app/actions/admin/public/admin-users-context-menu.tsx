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
  stateElementId: 'users-grid-state',
  fallbackBaseHref: '/admin/users',
  defaultSort: 'name',
}

/**
 * Right-click menu for admin user rows. The activate/deactivate item depends on
 * the row's `data-disabled-at` attribute, so the menu re-renders on capture.
 */
export const AdminUsersContextMenu = clientEntry(
  import.meta.url + '#AdminUsersContextMenu',
  createRowContextMenu({
    label: 'Benutzeraktionen',
    tableSelector: '[data-users-table]',
    reactive: true,
    items: (target) => {
      let isDisabled = (target?.row.getAttribute('data-disabled-at') ?? '') !== ''
      let isSelf = (target?.row.getAttribute('data-self') ?? '') === 'true'
      return (
        <>
          <MenuItem name="edit">
            <Glyph name="edit" width={14} height={14} /> Bearbeiten
          </MenuItem>
          <Separator />
          {isDisabled ? (
            <MenuItem name="activate">Aktivieren</MenuItem>
          ) : (
            <MenuItem name="deactivate" disabled={isSelf}>
              {isSelf ? 'Deaktivieren (eigenes Konto)' : 'Deaktivieren'}
            </MenuItem>
          )}
          <Separator />
          <MenuItem
            name="delete"
            disabled={isSelf}
            mix={css({ color: theme.colors.action.danger.background })}
          >
            <Glyph name="trash" width={14} height={14} />
            {isSelf ? 'Löschen (eigenes Konto)' : 'Löschen'}
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
          submitRowForm(target.rowId, 'data-toggle-form')
          break
        case 'deactivate':
          // Self-disable is blocked; enabling your own (impossible while
          // disabled and signed in) stays consistent with the row button.
          if (target.row.dataset.self === 'true') return
          submitRowForm(target.rowId, 'data-toggle-form')
          break
        case 'delete':
          if (target.row.dataset.self === 'true') return
          confirmAndSubmitRowForm(target.rowId, 'Wirklich löschen?')
          break
      }
    },
  }),
)
