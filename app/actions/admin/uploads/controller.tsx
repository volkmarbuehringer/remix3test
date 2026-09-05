import { createController } from 'remix/router'
import { css } from 'remix/ui'
import { SuperHeaders } from 'remix/headers'
import { theme } from '../../../ui/theme/theme.ts'
import { routes } from '../../../routes.ts'
import { parseId } from '../../../utils/ids.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import {
  getUploadsPage,
  uploadErrorMessages,
  claimUploads,
  getUploadDownload,
  UPLOAD_SORT_FIELDS,
  type UploadRow,
} from '../../../data/uploads.ts'
import { PageSection, panelCss } from '../../../ui/page-primitives.tsx'
import { CsrfTokenInput } from '../../../ui/csrf-token-input.tsx'
import { getCurrentUser } from '../../../utils/context.ts'
import { getPageSize } from '../../../utils/get-page-size.ts'
import { takeUploadedIds, takeUploadError } from '../../../middleware/upload-claim.ts'
import { table } from '../../../ui/mixins/admin-table.ts'
import { sortArrow } from '../../../ui/mixins/admin-urls.ts'
import { parseSort } from '../../../utils/sort-params.ts'
import { getSelfFrameTarget } from '../../../utils/frame-target.ts'
import { Glyph } from '../../../ui/theme/glyph/glyph.tsx'

const UPLOADS_PAGE_SIZE = 15

function parseUploadPage(raw: string | null): number {
  let n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

function uploadErrorFromParam(code: string | null): string | null {
  if (!code) return null
  return uploadErrorMessages[code] ?? null
}

function uploadsPageHref(
  page: number,
  sortColumn: string,
  sortDirection: 'asc' | 'desc',
  filter: string | undefined,
): string {
  let params = new URLSearchParams()
  params.set('page', String(page))
  params.set('sort', sortColumn)
  params.set('order', sortDirection)
  if (filter) params.set('filter', filter)
  return `${routes.admin.uploads.index.href()}?${params.toString()}`
}

/** Sort-toggle link: flipping the sort resets to page 1 for a stable grid. */
function uploadsSortHref(
  field: string,
  currentSort: string,
  currentOrder: 'asc' | 'desc',
  filter: string | undefined,
): string {
  let newOrder = field === currentSort ? (currentOrder === 'asc' ? 'desc' : 'asc') : 'asc'
  let params = new URLSearchParams()
  params.set('sort', field)
  params.set('order', newOrder)
  params.set('page', '1')
  if (filter) params.set('filter', filter)
  return `${routes.admin.uploads.index.href()}?${params.toString()}`
}

export default createController(routes.admin.uploads, {
  middleware: [requireAuth()],
  actions: {
    async index(context) {
      let user = getCurrentUser()
      let page = parseUploadPage(context.url.searchParams.get('page'))
      let uploadError = uploadErrorFromParam(context.url.searchParams.get('uploadError'))
      let filter = context.url.searchParams.get('filter') || undefined
      let pageSize = getPageSize(context.session, UPLOADS_PAGE_SIZE)
      let { column, direction } = parseSort(context.url, {
        allowedColumns: UPLOAD_SORT_FIELDS,
        defaultColumn: 'created_at',
        defaultDirection: 'desc',
      })
      let {
        rows,
        totalPages,
        page: effectivePage,
      } = await getUploadsPage(
        context.db,
        user.role === 'admin' ? undefined : user.id,
        page,
        pageSize,
        column,
        direction,
        filter,
      )
      return renderAdminPage(
        context.render,
        'uploads',
        <UploadsContent
          uploads={rows}
          page={effectivePage}
          totalPages={totalPages}
          uploadedIds={[]}
          uploadError={uploadError}
          sortColumn={column}
          sortDirection={direction}
          filter={filter}
        />,
      )
    },

    async action(context) {
      let user = getCurrentUser()
      let uploadedIds = takeUploadedIds()
        .map(Number)
        .filter((id) => !Number.isNaN(id))

      let uploadError = takeUploadError()
      if (uploadedIds.length > 0) {
        let claimed = await claimUploads(context.db, uploadedIds, user.id)
        if (!claimed) {
          uploadError =
            'Upload abgelehnt: Das Speicherkontingent ist erschöpft. Bitte löschen Sie alte Dateien.'
          uploadedIds = []
        }
      } else {
        let attemptedUpload =
          context.request.headers.get('Content-Type')?.startsWith('multipart/') ?? false
        if (attemptedUpload && uploadError == null) {
          uploadError =
            'Upload fehlgeschlagen. Die Datei könnte zu groß sein oder der Server hatte einen Fehler.'
        }
      }

      let pageSize = getPageSize(context.session, UPLOADS_PAGE_SIZE)
      let { rows, totalPages, page } = await getUploadsPage(
        context.db,
        user.role === 'admin' ? undefined : user.id,
        1,
        pageSize,
        'created_at',
        'desc',
      )
      return renderAdminPage(
        context.render,
        'uploads',
        <UploadsContent
          uploads={rows}
          page={page}
          totalPages={totalPages}
          uploadedIds={uploadedIds}
          uploadError={uploadError}
          sortColumn="created_at"
          sortDirection="desc"
          filter={undefined}
        />,
      )
    },

    async download(context) {
      let user = getCurrentUser()
      let id = parseId(context.params.id)
      if (id === undefined) {
        return new Response('Invalid ID', { status: 400 })
      }

      let row =
        user.role === 'admin'
          ? await getUploadDownload(context.db, id)
          : await getUploadDownload(context.db, id, user.id)
      if (!row) {
        return new Response('Not found', { status: 404 })
      }

      let { filename, mime_type, data } = row

      let cleanFilename = filename.replace(/[\r\n"]/g, '')

      let downloadHeaders = new SuperHeaders()
      downloadHeaders.contentType = mime_type
      downloadHeaders.contentDisposition = {
        type: 'attachment',
        filename: cleanFilename,
      }
      return new Response(data, { status: 200, headers: downloadHeaders })
    },
  },
})

type UploadsContentProps = {
  uploads: UploadRow[]
  page: number
  totalPages: number
  uploadedIds: number[]
  uploadError: string | null
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
}

function UploadsContent(handle: { props: UploadsContentProps }) {
  return () => {
    let { uploads, page, totalPages, uploadedIds, uploadError, sortColumn, sortDirection, filter } =
      handle.props

    return (
      <PageSection
        title="Datei-Upload"
        description="Laden Sie Dateien hoch, die in der Datenbank gespeichert werden."
        mix={pageSectionCss}
      >
        <div mix={[panelCss, uploadPanelCss]}>
          {uploadedIds.length > 0 ? (
            <p mix={successBanner}>
              {uploadedIds.length === 1
                ? `Datei hochgeladen (ID: ${uploadedIds[0]}).`
                : `${uploadedIds.length} Dateien hochgeladen (IDs: ${uploadedIds.join(', ')}).`}
            </p>
          ) : null}
          {uploadError ? (
            <p role="alert" mix={errorBanner}>
              {uploadError}
            </p>
          ) : null}
          <form
            action={routes.admin.uploads.action.href()}
            method="POST"
            encType="multipart/form-data"
            mix={formCss}
          >
            <CsrfTokenInput />
            <input type="file" name="file" multiple required mix={fileInputCss} />
            <button type="submit" mix={submitCss}>
              Hochladen
            </button>
          </form>
          <form
            method="GET"
            action={routes.admin.uploads.index.href()}
            data-rmx-target={getSelfFrameTarget()}
            mix={filterBarCss}
          >
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="sort" value={sortColumn} />
            <input type="hidden" name="order" value={sortDirection} />
            <input
              type="text"
              name="filter"
              placeholder="durchsuchen"
              defaultValue={filter ?? ''}
              aria-label="Dateien durchsuchen"
              mix={table.filterInput}
            />
            <button type="submit" mix={table.searchBtn}>
              <Glyph name="search" width={14} height={14} /> Suchen
            </button>
            {filter ? (
              <a
                href={routes.admin.uploads.index.href()}
                data-rmx-target={getSelfFrameTarget()}
                mix={table.clearLink}
              >
                Zurücksetzen
              </a>
            ) : null}
          </form>
        </div>

        <div mix={[panelCss, tablePanelCss]}>
          {uploads.length > 0 ? (
            <div mix={tableScrollCss}>
              <table mix={tableCss}>
                <thead>
                  <tr>
                    <th aria-sort={sortRule('id', sortColumn, sortDirection)}>
                      <a
                        href={uploadsSortHref('id', sortColumn, sortDirection, filter)}
                        data-rmx-target={getSelfFrameTarget()}
                        mix={sortLinkCss}
                      >
                        ID
                        <span mix={sortColumn === 'id' ? sortArrowActiveCss : sortArrowCss}>
                          {sortArrow('id', sortColumn, sortDirection)}
                        </span>
                      </a>
                    </th>
                    <th aria-sort={sortRule('filename', sortColumn, sortDirection)}>
                      <a
                        href={uploadsSortHref('filename', sortColumn, sortDirection, filter)}
                        data-rmx-target={getSelfFrameTarget()}
                        mix={sortLinkCss}
                      >
                        Dateiname
                        <span mix={sortColumn === 'filename' ? sortArrowActiveCss : sortArrowCss}>
                          {sortArrow('filename', sortColumn, sortDirection)}
                        </span>
                      </a>
                    </th>
                    <th aria-sort={sortRule('mime_type', sortColumn, sortDirection)}>
                      <a
                        href={uploadsSortHref('mime_type', sortColumn, sortDirection, filter)}
                        data-rmx-target={getSelfFrameTarget()}
                        mix={sortLinkCss}
                      >
                        Typ
                        <span mix={sortColumn === 'mime_type' ? sortArrowActiveCss : sortArrowCss}>
                          {sortArrow('mime_type', sortColumn, sortDirection)}
                        </span>
                      </a>
                    </th>
                    <th aria-sort={sortRule('size', sortColumn, sortDirection)}>
                      <a
                        href={uploadsSortHref('size', sortColumn, sortDirection, filter)}
                        data-rmx-target={getSelfFrameTarget()}
                        mix={sortLinkCss}
                      >
                        Größe
                        <span mix={sortColumn === 'size' ? sortArrowActiveCss : sortArrowCss}>
                          {sortArrow('size', sortColumn, sortDirection)}
                        </span>
                      </a>
                    </th>
                    <th aria-sort={sortRule('created_at', sortColumn, sortDirection)}>
                      <a
                        href={uploadsSortHref('created_at', sortColumn, sortDirection, filter)}
                        data-rmx-target={getSelfFrameTarget()}
                        mix={sortLinkCss}
                      >
                        Datum
                        <span mix={sortColumn === 'created_at' ? sortArrowActiveCss : sortArrowCss}>
                          {sortArrow('created_at', sortColumn, sortDirection)}
                        </span>
                      </a>
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.filename}</td>
                      <td>{u.mime_type}</td>
                      <td>{formatSize(u.size)}</td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td>
                        <a href={routes.admin.uploads.download.href({ id: u.id })} download>
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p mix={bodyTextCss}>
              {filter
                ? 'Keine Dateien gefunden für diese Suche.'
                : 'Noch keine Dateien hochgeladen.'}
            </p>
          )}

          <div mix={paginationCss}>
            <span mix={table.paginationInfo}>
              Seite {page} von {totalPages}
            </span>
            <div mix={paginationButtonsCss}>
              {page > 1 ? (
                <a
                  href={uploadsPageHref(page - 1, sortColumn, sortDirection, filter)}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={table.pageLink}
                >
                  Zurück
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>Zurück</span>
              )}
              {page < totalPages ? (
                <a
                  href={uploadsPageHref(page + 1, sortColumn, sortDirection, filter)}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={table.pageLink}
                >
                  Vor
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>Vor</span>
              )}
            </div>
          </div>
        </div>
      </PageSection>
    )
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function sortRule(
  field: string,
  sortField: string,
  sortOrder: 'asc' | 'desc',
): 'ascending' | 'descending' | undefined {
  if (field !== sortField) return undefined
  return sortOrder === 'asc' ? 'ascending' : 'descending'
}

const formCss = css({
  display: 'flex',
  gap: theme.space.md,
  alignItems: 'flex-end',
})

const fileInputCss = css({
  flex: 1,
})

const submitCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.5rem 1.5rem',
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: 'white',
  background: theme.colors.action.primary.background,
  border: 'none',
  borderRadius: theme.radius.md,
  cursor: 'pointer',
})

const successBanner = css({
  backgroundColor: '#d1fae5',
  border: '1px solid #6ee7b7',
  borderRadius: theme.radius.md,
  color: '#065f46',
  marginBottom: theme.space.md,
  padding: theme.space.md,
})

const errorBanner = css({
  backgroundColor: theme.colors.action.danger.background,
  border: `1px solid ${theme.colors.action.danger.border}`,
  borderRadius: theme.radius.md,
  color: theme.colors.action.danger.foreground,
  marginBottom: theme.space.md,
  padding: theme.space.md,
})

const bodyTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
})

const tableCss = css({
  width: '100%',
  borderCollapse: 'collapse',
  '& th, & td': {
    padding: theme.space.xs,
    textAlign: 'left',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  '& th': {
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.muted,
    position: 'sticky',
    top: 0,
    background: theme.surface.lvl1,
    zIndex: 1,
  },
})

const sortLinkCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  textDecoration: 'none',
  color: 'inherit',
  cursor: 'pointer',
  '&:hover': { color: theme.colors.text.primary },
})

const filterBarCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space.sm,
  flexShrink: 0,
})

const sortArrowCss = css({
  fontSize: theme.fontSize.xs,
  lineHeight: 1,
  color: theme.colors.text.muted,
})

const sortArrowActiveCss = css({
  fontSize: theme.fontSize.xs,
  lineHeight: 1,
  color: theme.colors.text.primary,
  fontWeight: theme.fontWeight.bold,
})

// Viewport-bounded page: let the page section fill the remaining content height
// so the table region can absorb it and scroll internally (see the
// remix3-bounded-scroll-flexchain pattern). The reduced `gap` here also tightens
// vertical spacing between the section header and the two panels.
const pageSectionCss = css({
  flex: 1,
  minHeight: 0,
  gap: theme.space.sm,
})

// Compact the upload/search panel so it takes less vertical space on screen
// (smaller padding and internal gap than the shared `panelCss` defaults).
const uploadPanelCss = css({
  padding: theme.space.xs,
  gap: theme.space.xs,
})

const tablePanelCss = css({
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  padding: theme.space.md,
})

const tableScrollCss = css({
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
})

const paginationCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.md,
  marginTop: theme.space.md,
  flexShrink: 0,
})

const paginationButtonsCss = css({
  display: 'flex',
  gap: theme.space.sm,
})
