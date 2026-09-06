import { createController } from 'remix/router'
import { css, type Handle } from 'remix/ui'
import { SuperHeaders } from 'remix/headers'
import { redirect } from 'remix/response/redirect'
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
  deleteUpload,
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
import { RestfulForm } from '../../../ui/restful-form.tsx'
import { ConfirmDelete } from '../../../ui/confirm-delete.browser.tsx'
import { AdminUploadsContextMenu } from '../public/admin-uploads-context-menu.tsx'
import type { AppContext } from '../../../types/context.ts'

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

type UploadsGridOpts = {
  page?: number | undefined
  sortColumn?: string | undefined
  sortDirection?: 'asc' | 'desc' | undefined
  filter?: string | undefined
  uploadedIds?: number[] | undefined
  uploadError?: string | null | undefined
}

/**
 * Shared renderer for the uploads grid. Reads the grid state (page, sort,
 * order, filter) from the request URL by default; callers may override it via
 * `opts` — used by the frame's destroyResolve and the post-upload action.
 */
async function renderUploadsPage(
  context: Pick<AppContext, 'db' | 'render' | 'session' | 'url'>,
  opts: UploadsGridOpts = {},
): Promise<Response> {
  let user = getCurrentUser()
  let page = opts.page ?? parseUploadPage(context.url.searchParams.get('page'))
  let uploadError =
    opts.uploadError !== undefined
      ? opts.uploadError
      : uploadErrorFromParam(context.url.searchParams.get('uploadError'))
  let filter =
    opts.filter !== undefined ? opts.filter : context.url.searchParams.get('filter') || undefined
  let pageSize = getPageSize(context.session, UPLOADS_PAGE_SIZE)
  let { column, direction } = parseSort(context.url, {
    allowedColumns: UPLOAD_SORT_FIELDS,
    defaultColumn: 'created_at',
    defaultDirection: 'desc',
  })
  let sortColumn = opts.sortColumn ?? column
  let sortDirection = opts.sortDirection ?? direction
  let {
    rows,
    totalPages,
    page: effectivePage,
  } = await getUploadsPage(
    context.db,
    user.role === 'admin' ? undefined : user.id,
    page,
    pageSize,
    sortColumn,
    sortDirection,
    filter,
  )
  return renderAdminPage(
    context.render,
    'uploads',
    <UploadsContent
      uploads={rows}
      page={effectivePage}
      totalPages={totalPages}
      uploadedIds={opts.uploadedIds ?? []}
      uploadError={uploadError}
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      filter={filter}
    />,
  )
}

export default createController(routes.admin.uploads, {
  middleware: [requireAuth()],
  actions: {
    async index(context) {
      return renderUploadsPage(context)
    },

    // The frame commits the POST delete form action path (form action == frame
    // src) as its address after submission, and the live ConnectionIndicator
    // reloads it on invalidate. Render the list so that a GET of the action
    // path resolves instead of falling to a 404 on the POST-only delete route.
    async destroyResolve(context) {
      return renderUploadsPage(context)
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

      return renderUploadsPage(context, {
        page: 1,
        sortColumn: 'created_at',
        sortDirection: 'desc',
        filter: undefined,
        uploadedIds,
        uploadError,
      })
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

    async destroy(context) {
      let user = getCurrentUser()
      let id = parseId(context.params.id)
      if (id === undefined) {
        return new Response('Invalid ID', { status: 400 })
      }

      // Admins may delete any row; a non-admin caller is restricted to rows they
      // claimed (uploaded_by = user.id). Failing to find a matching row is
      // treated as a no-op — we still reload the grid.
      await deleteUpload(context.db, id, user.role === 'admin' ? undefined : user.id)

      // Preserve the current grid state (page, sort, order, filter) so the
      // post-delete redirect lands back on the same view. The page is clamped
      // back to a valid range by getUploadsPage on the next render.
      let form = context.formData
      let page = parseUploadPage(form.get('_page') as string | null)
      let sortColumn = (form.get('_sort') as string | null) ?? 'created_at'
      let sortDirection: 'asc' | 'desc' =
        (form.get('_order') as string | null) === 'asc' ? 'asc' : 'desc'
      let filter = (form.get('_filter') as string | null) || undefined

      return redirect(uploadsPageHref(page, sortColumn, sortDirection, filter))
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
          <ConfirmDelete />
          {uploads.length > 0 ? (
            <div mix={tableScrollCss}>
              <table mix={tableCss} data-uploads-table="true">
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
                    <th mix={thActionsCss}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((u) => (
                    <tr key={u.id} data-row-id={u.id} data-upload-filename={u.filename}>
                      <td>{u.id}</td>
                      <td>{u.filename}</td>
                      <td>{u.mime_type}</td>
                      <td>{formatSize(u.size)}</td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td mix={tdActionsCss}>
                        <div mix={rowActionsCss}>
                          <a
                            href={routes.admin.uploads.download.href({ id: u.id })}
                            download
                            data-download-link
                            data-rmx-target={getSelfFrameTarget()}
                            mix={iconActionCss}
                            aria-label="Datei herunterladen"
                            title="Datei herunterladen"
                          >
                            <Glyph name="download" width={14} height={14} />
                          </a>
                          <RestfulForm
                            method="POST"
                            action={routes.admin.uploads.destroy.href({ id: u.id })}
                            data-delete-form={u.id}
                            data-confirm={`Datei "${u.filename}" wirklich löschen?`}
                            data-rmx-target={getSelfFrameTarget()}
                            mix={css({ margin: 0, padding: 0 })}
                          >
                            <UploadsGridStateHiddenInputs
                              page={page}
                              sortColumn={sortColumn}
                              sortDirection={sortDirection}
                              filter={filter}
                            />
                            <button
                              type="submit"
                              mix={[iconActionCss, iconActionDangerCss]}
                              aria-label="Datei löschen"
                              title="Datei löschen"
                            >
                              <Glyph name="trash" width={14} height={14} />
                            </button>
                          </RestfulForm>
                        </div>
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

        <AdminUploadsContextMenu />
      </PageSection>
    )
  }
}

type UploadsGridStateHiddenInputsProps = {
  page: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
}

/** Carries the uploads grid state through a delete submit so the post-delete
 * redirect lands back on the same page/sort/order/filter view. Unlike the
 * shared {@link GridStateHiddenInputs} (offset-based), uploads paginates by
 * page number, so it emits `_page` instead of `_offset`. */
function UploadsGridStateHiddenInputs(handle: Handle<UploadsGridStateHiddenInputsProps>) {
  return () => {
    let { page, sortColumn, sortDirection, filter } = handle.props
    return (
      <>
        <input type="hidden" name="_page" value={page} />
        <input type="hidden" name="_sort" value={sortColumn} />
        <input type="hidden" name="_order" value={sortDirection} />
        <input type="hidden" name="_filter" value={filter ?? ''} />
      </>
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

const thActionsCss = css({
  textAlign: 'right',
  width: '170px',
})

const tdActionsCss = css({
  textAlign: 'right',
  whiteSpace: 'nowrap',
})

const rowActionsCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: theme.space.xs,
})

const iconActionCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  minWidth: '28px',
  padding: 0,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  textDecoration: 'none',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
})

const iconActionDangerCss = css({
  color: theme.colors.action.danger.background,
  borderColor: 'transparent',
  '&:hover': {
    background: theme.colors.action.danger.background,
    color: theme.colors.action.danger.foreground,
  },
})
