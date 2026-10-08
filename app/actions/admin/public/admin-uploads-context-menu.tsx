import { clientEntry, css } from 'remix/component'

import { confirmAndSubmitRowForm, createRowContextMenu } from '../../../ui/row-context-menu.tsx'
import { Glyph } from '../../../ui/theme/glyph/glyph.tsx'
import { MenuItem } from '../../../ui/theme/menu/index.tsx'
import { Separator } from '../../../ui/theme/separator/separator.ts'
import { theme } from '../../../ui/theme/theme.ts'

/**
 * Right-click menu for admin upload rows. "Herunterladen" reuses the row's
 * server-rendered download link and "Löschen" its per-row delete form, so the
 * menu adds no second code path for CSRF, grid state, or the frame runtime.
 */
export const AdminUploadsContextMenu = clientEntry(
  import.meta.url + '#AdminUploadsContextMenu',
  createRowContextMenu({
    label: 'Dateiaktionen',
    tableSelector: '[data-uploads-table]',
    items: () => (
      <>
        <MenuItem name="download">
          <Glyph name="download" width={14} height={14} /> Herunterladen
        </MenuItem>
        <Separator />
        <MenuItem name="delete" mix={css({ color: theme.colors.action.danger.background })}>
          <Glyph name="trash" width={14} height={14} /> Löschen
        </MenuItem>
      </>
    ),
    onSelect: (name, target) => {
      if (name === 'download') {
        let link = document.querySelector<HTMLAnchorElement>(
          `[data-row-id="${target.rowId}"] a[data-download-link]`,
        )
        if (link) link.click()
      } else if (name === 'delete') {
        let filename = target.row.getAttribute('data-upload-filename')
        confirmAndSubmitRowForm(
          target.rowId,
          filename ? `Datei "${filename}" wirklich löschen?` : 'Wirklich löschen?',
        )
      }
    },
  }),
)
