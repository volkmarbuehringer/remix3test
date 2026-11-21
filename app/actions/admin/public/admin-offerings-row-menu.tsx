import { clientEntry, css, ref, type Handle } from 'remix/component'
import * as menu from '@remix-run/ui/menu'
import { onMenuSelect } from '@remix-run/ui/menu'

import { table } from '../../../ui/mixins/admin-table.ts'
import {
  confirmAndSubmitRowForm,
  navigateGridParam,
  type GridNavigation,
} from '../../../ui/row-context-menu.tsx'
import { theme } from '../../../ui/theme/theme.ts'
import { Glyph } from '../../../ui/theme/glyph/glyph.tsx'
import { MenuItem, MenuList } from '../../../ui/theme/menu/index.tsx'
import { Separator } from '../../../ui/theme/separator/separator.ts'
import { routes } from '../../../routes.ts'

const navigation: GridNavigation = {
  stateElementId: 'offerings-grid-state',
  fallbackBaseHref: routes.verwaltung.offerings.index.href(),
  defaultSort: 'ao.id',
}

const triggerGlyphCss = css({
  fontSize: theme.fontSize.lg,
  lineHeight: 1,
  transform: 'translateY(-1px)',
})

const deleteItemCss = css({
  color: theme.colors.action.danger.background,
})

interface AdminOfferingsRowMenuProps {
  rowId: string
  resourceId: string
  /** Distinguishes the per-row trigger for assistive tech. */
  rowLabel: string
}

/**
 * Visible per-row kebab for the offerings grid. Edit stays a direct link;
 * configuration and delete use the same navigation/confirmation helpers as the
 * right-click menu so both affordances stay in sync.
 */
export const AdminOfferingsRowMenu = clientEntry(
  import.meta.url + '#AdminOfferingsRowMenu',
  function AdminOfferingsRowMenu(handle: Handle<AdminOfferingsRowMenuProps>) {
    return () => {
      let { rowId, resourceId, rowLabel } = handle.props

      return (
        <menu.Context label={`Angebotsaktionen für ${rowLabel}`}>
          <button
            type="button"
            data-offerings-row-menu-trigger={rowId}
            aria-label={`Weitere Aktionen für ${rowLabel}`}
            title="Weitere Aktionen"
            mix={[
              table.actionSeg,
              table.actionSegLast,
              menu.trigger(),
              ref((el) => {
                el.dataset.offeringsRowMenuReady = 'true'
              }),
            ]}
          >
            <span aria-hidden="true" mix={triggerGlyphCss}>
              ⋮
            </span>
          </button>
          <MenuList
            mix={onMenuSelect((event) => {
              if (event.item.name === 'config') {
                navigateGridParam(handle, navigation, 'config', resourceId)
              } else if (event.item.name === 'delete') {
                confirmAndSubmitRowForm(rowId, 'Wirklich löschen?')
              }
            })}
          >
            <MenuItem name="config">
              <Glyph name="cog" width={14} height={14} /> Konfiguration
            </MenuItem>
            <Separator />
            <MenuItem name="delete" mix={deleteItemCss}>
              <Glyph name="trash" width={14} height={14} /> Löschen
            </MenuItem>
          </MenuList>
        </menu.Context>
      )
    }
  },
)
