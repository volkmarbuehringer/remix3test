import { createController } from 'remix/router'
import { css, type Handle } from 'remix/ui'
import { SuperHeaders } from 'remix/headers'
import { redirect } from 'remix/response/redirect'
import {
  formCss,
  fileInputCss,
  submitCss,
  successBanner,
  errorBanner,
  bodyTextCss,
  tableCss,
  sortLinkCss,
  toolsRowCss,
  filterBarCss,
  sortArrowCss,
  sortArrowActiveCss,
  pageSectionCss,
  uploadPanelCss,
  tablePanelCss,
  tableScrollCss,
  paginationCss,
  paginationButtonsCss,
  thActionsCss,
  thCheckboxCss,
  tdCheckboxCss,
  bulkFormCss,
  bulkGroupCss,
  bulkToolbarCss,
  selectedCountCss,
  bulkDeleteBtnCss,
  bulkDownloadBtnCss,
  tdActionsCss,
  rowActionsCss,
  iconActionCss,
  iconActionDangerCss,
  rowMenuCss,
  idCellCss,
  filenameCellCss,
  sizeCellCss,
  mimeBadgeCss,
  emptyStateCss,
  emptyStateGlyph,
  dropzoneCss,
  dropzoneLabelCss,
  dropzoneHintCss,
  pendingListCss,
  validationErrorCss,
  quotaRowCss,
  quotaTextCss,
  quotaTrackCss,
  quotaTrackNearCss,
  quotaFillCss,
  quotaFillNearCss,
  clearSelectionBtnCss,
} from './uploads-grid-css.ts'
import { routes } from '../../../routes.ts'
import { parseId } from '../../../utils/ids.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import {
  getUploadsPage,
  getUploadsQuotaUsage,
  uploadErrorMessages,
  claimUploads,
  getUploadDownload,
  getUploadsByIds,
  deleteUpload,
  deleteUploads,
  UPLOAD_SORT_FIELDS,
  type UploadRow,
} from '../../../data/uploads.ts'
import { buildZipArchive } from '../../../utils/zip.ts'
import { PageSection, panelCss } from '../../../ui/page-primitives.tsx'
import { CsrfTokenInput } from '../../../ui/csrf-token-input.tsx'
import { getCurrentUser } from '../../../utils/context.ts'
import { getPageSize } from '../../../utils/get-page-size.ts'
import { takeUploadedIds, takeUploadError } from '../../../middleware/upload-claim.ts'
import { table } from '../../../ui/mixins/admin-table.ts'
import { sortArrow } from '../../../ui/mixins/admin-urls.ts'
import { parseSort } from '../../../utils/sort-params.ts'
import { getSelfFrameTarget } from '../../../utils/frame-target.ts'
import { formatRelativeTimeDE } from '../../../utils/date-utils.ts'
import { formatUploadType, formatBytes } from '../../../utils/upload-validation.ts'
import { Glyph } from '../../../ui/theme/glyph/glyph.tsx'
import { RestfulForm } from '../../../ui/restful-form.tsx'
import { ConfirmDelete } from '../../../ui/confirm-delete.browser.tsx'
import { AdminUploadsContextMenu } from '../public/admin-uploads-context-menu.tsx'
import { UploadBulkDelete } from '../public/admin-uploads-bulk-delete.tsx'
import { UploadBulkDownload } from '../public/admin-uploads-bulk-download.tsx'
import { UploadDropzone } from '../public/admin-uploads-dropzone.tsx'
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
  deleted?: number | undefined,
): string {
  let params = new URLSearchParams()
  params.set('page', String(page))
  params.set('sort', sortColumn)
  params.set('order', sortDirection)
  if (filter) params.set('filter', filter)
  let base = `${routes.admin.uploads.index.href()}?${params.toString()}`
  return deleted !== undefined ? `${base}&deleted=${deleted}` : base
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
  deletedCount?: number | undefined
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
  let deletedCount =
    opts.deletedCount !== undefined
      ? opts.deletedCount
      : Number(context.url.searchParams.get('deleted')) || 0
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
    total,
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
  let quota = await getUploadsQuotaUsage(context.db, user.role === 'admin' ? undefined : user.id)
  return renderAdminPage(
    context.render,
    'uploads',
    <UploadsContent
      uploads={rows}
      page={effectivePage}
      total={total}
      totalPages={totalPages}
      uploadedIds={opts.uploadedIds ?? []}
      uploadError={uploadError}
      deletedCount={deletedCount}
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      filter={filter}
      quota={quota}
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

    // Multirow download: zip the selected rows into a single attachment. The
    // grid form submits with `data-rmx-document`, so the frame runtime leaves
    // the submission to the browser and the ZIP is downloaded natively.
    async downloadMany(context) {
      let user = getCurrentUser()

      // Checkboxes named `ids` submit only the checked rows; map to numbers and
      // drop any non-numeric (or empty) values. Ownership is enforced inside
      // getUploadsByIds, so a non-admin cannot download another user's rows even
      // if their ids are submitted.
      let ids = context.formData
        .getAll('ids')
        .map((value) => Number(value))
        .filter((id) => !Number.isNaN(id))
      if (ids.length === 0) {
        return new Response('Keine Dateien ausgew\u00e4hlt', { status: 400 })
      }

      let uploads = await getUploadsByIds(
        context.db,
        ids,
        user.role === 'admin' ? undefined : user.id,
      )
      if (uploads.length === 0) {
        return new Response('Dateien nicht gefunden', { status: 404 })
      }

      // Deduplicate entry names so a ZIP with two same-named uploads stays
      // unambiguous (a name already used is prefixed with its row id).
      let usedNames = new Set<string>()
      let entries = uploads.map((u) => {
        let name = u.filename
        if (usedNames.has(name)) name = `${u.id}-${name}`
        usedNames.add(name)
        return { filename: name, data: u.data }
      })

      let archive = buildZipArchive(entries)

      let zipHeaders = new SuperHeaders()
      zipHeaders.contentType = 'application/zip'
      zipHeaders.contentDisposition = {
        type: 'attachment',
        filename: 'uploads.zip',
      }
      zipHeaders.contentLength = archive.length
      return new Response(new Uint8Array(archive), { status: 200, headers: zipHeaders })
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

    async destroyMany(context) {
      let user = getCurrentUser()

      // Checkboxes named `ids` submit only the checked rows; map to numbers and
      // drop any non-numeric (or empty) values. Ownership is enforced inside
      // deleteUploads, so a non-admin cannot delete another user's rows even if
      // their ids are submitted.
      let ids = context.formData
        .getAll('ids')
        .map((value) => Number(value))
        .filter((id) => !Number.isNaN(id))
      let deleted = await deleteUploads(
        context.db,
        ids,
        user.role === 'admin' ? undefined : user.id,
      )

      let form = context.formData
      let page = parseUploadPage(form.get('_page') as string | null)
      let sortColumn = (form.get('_sort') as string | null) ?? 'created_at'
      let sortDirection: 'asc' | 'desc' =
        (form.get('_order') as string | null) === 'asc' ? 'asc' : 'desc'
      let filter = (form.get('_filter') as string | null) || undefined

      // Only carry the count (and thus the banner) when rows were actually
      // removed; omitting it for a no-op keeps the redirect URL clean.
      return redirect(
        uploadsPageHref(page, sortColumn, sortDirection, filter, deleted > 0 ? deleted : undefined),
      )
    },

    async destroyManyResolve(context) {
      return renderUploadsPage(context)
    },
  },
})

type UploadsContentProps = {
  uploads: UploadRow[]
  page: number
  total: number
  totalPages: number
  uploadedIds: number[]
  uploadError: string | null
  deletedCount: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  quota: {
    userUsedBytes: number
    userQuotaBytes: number | null
    totalUsedBytes: number
    totalQuotaBytes: number
  }
}

function UploadsContent(handle: { props: UploadsContentProps }) {
  return () => {
    let {
      uploads,
      page,
      total,
      totalPages,
      uploadedIds,
      uploadError,
      deletedCount,
      sortColumn,
      sortDirection,
      filter,
      quota,
    } = handle.props

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
          {deletedCount > 0 ? (
            <p mix={successBanner} data-deleted-banner>
              {deletedCount === 1 ? '1 Datei gelöscht.' : `${deletedCount} Dateien gelöscht.`}
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
            data-upload-form
            mix={formCss}
          >
            <CsrfTokenInput />
            <div mix={dropzoneCss} data-dropzone>
              {uploadIcon()}
              <label htmlFor="upload-file-input" mix={dropzoneLabelCss}>
                Dateien auswählen
              </label>
              <span mix={dropzoneHintCss} data-drop-hint>
                oder hierher ziehen
              </span>
              <input
                id="upload-file-input"
                type="file"
                name="file"
                multiple
                aria-label="Dateien zum Hochladen auswählen"
                mix={fileInputCss}
                data-file-input
              />
            </div>
            <ul mix={pendingListCss} data-pending-list hidden aria-live="polite"></ul>
            <p role="alert" mix={validationErrorCss} data-upload-validation hidden></p>
            <button type="submit" mix={submitCss} data-upload-submit>
              <span data-upload-idle>
                <Glyph name="send" width={14} height={14} /> Hochladen
              </span>
              <span data-upload-busy hidden aria-hidden="true">
                <Glyph name="spinner" width={14} height={14} /> Hochladen …
              </span>
            </button>
            <UploadDropzone />
          </form>
          <div mix={quotaRowCss}>
            {quota.userQuotaBytes != null ? (
              <span mix={quotaTextCss} data-user-quota>
                <Glyph name="info" width={14} height={14} /> {formatBytes(quota.userUsedBytes)} von{' '}
                {formatBytes(quota.userQuotaBytes)} belegt
              </span>
            ) : null}
            <span mix={quotaTextCss} data-total-quota>
              <Glyph name="zap" width={14} height={14} /> Gesamt:{' '}
              {formatBytes(quota.totalUsedBytes)} von {formatBytes(quota.totalQuotaBytes)}
            </span>
            {quotaBar(quota)}
          </div>
          <div mix={toolsRowCss}>
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
            {uploads.length > 0 ? (
              <div mix={bulkGroupCss}>
                <form
                  id="bulk-delete-form"
                  method="POST"
                  action={routes.admin.uploads.destroyMany.href()}
                  data-rmx-target={getSelfFrameTarget()}
                  data-bulk-delete-form
                  mix={bulkFormCss}
                >
                  <CsrfTokenInput />
                  <UploadsGridStateHiddenInputs
                    page={page}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    filter={filter}
                  />
                  <div mix={bulkToolbarCss}>
                    <span mix={selectedCountCss} data-selected-count>
                      0 ausgewählt
                    </span>
                    <button
                      type="button"
                      data-clear-selection
                      mix={clearSelectionBtnCss}
                      aria-label="Auswahl aufheben"
                    >
                      Auswahl aufheben
                    </button>
                    <button type="submit" disabled mix={bulkDeleteBtnCss}>
                      <Glyph name="trash" width={14} height={14} /> Ausgewählte löschen
                    </button>
                  </div>
                </form>
                <form
                  id="bulk-download-form"
                  method="POST"
                  action={routes.admin.uploads.downloadMany.href()}
                  data-rmx-document
                  data-bulk-download-form
                  mix={bulkFormCss}
                >
                  <CsrfTokenInput />
                  <div mix={bulkToolbarCss}>
                    <button type="submit" disabled mix={bulkDownloadBtnCss}>
                      <Glyph name="download" width={14} height={14} /> Ausgewählte herunterladen
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        </div>

        <div mix={[panelCss, tablePanelCss]}>
          <ConfirmDelete />
          <UploadBulkDelete />
          <UploadBulkDownload />
          {uploads.length > 0 ? (
            <div mix={tableScrollCss}>
              <table mix={tableCss} data-uploads-table="true" data-selection-scope={filter ?? ''}>
                <thead>
                  <tr>
                    <th mix={thCheckboxCss}>
                      <input
                        type="checkbox"
                        data-select-all
                        aria-label="Alle Dateien auf dieser Seite auswählen"
                      />
                    </th>
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
                      <td mix={tdCheckboxCss}>
                        <input
                          type="checkbox"
                          form="bulk-delete-form"
                          name="ids"
                          value={u.id}
                          data-select-id
                          aria-label={`Datei ${u.filename} auswählen`}
                        />
                      </td>
                      <td mix={idCellCss}>{u.id}</td>
                      <td mix={filenameCellCss}>{u.filename}</td>
                      <td>
                        <span mix={mimeBadgeCss} data-mime={u.mime_type}>
                          {formatUploadType(u.mime_type)}
                        </span>
                      </td>
                      <td mix={sizeCellCss}>{formatSize(u.size)}</td>
                      <td>
                        <span title={new Date(u.created_at).toLocaleString('de-DE')}>
                          {formatRelativeTimeDE(u.created_at)}
                        </span>
                      </td>
                      <td mix={tdActionsCss}>
                        <div mix={rowActionsCss}>
                          <button
                            type="button"
                            data-row-menu-trigger
                            mix={rowMenuCss}
                            aria-label={`Mehr Optionen für ${u.filename}`}
                            title="Mehr Optionen"
                          >
                            {ellipsisIcon()}
                          </button>
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
            <div mix={emptyStateCss}>
              <div mix={emptyStateGlyph}>{uploadIcon()}</div>
              <p mix={bodyTextCss}>
                {filter
                  ? 'Keine Dateien gefunden für diese Suche.'
                  : 'Noch keine Dateien hochgeladen. Ziehen Sie eine Datei hierher oder wählen Sie eine aus.'}
              </p>
            </div>
          )}

          <div mix={paginationCss}>
            <span mix={table.paginationInfo} aria-current="page">
              {total} Dateien · Seite {page} von {totalPages}
            </span>
            <div mix={paginationButtonsCss}>
              {page > 1 ? (
                <a
                  href={uploadsPageHref(page - 1, sortColumn, sortDirection, filter)}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={table.pageLink}
                  aria-label={`Seite ${page - 1}`}
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
                  aria-label={`Seite ${page + 1}`}
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

/** Upward-arrow upload glyph for the dropzone and empty state. */
function uploadIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

/** Horizontal ellipsis "more options" glyph for the per-row menu trigger. */
function ellipsisIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  )
}

/**
 * Storage-usage progress bar. Shows the narrower of the two quotas (per-user for
 * a non-admin, the global quota for an admin) so the bar never claims more
 * headroom than the user actually has, and turns warning-coloured near the limit.
 */
function quotaBar(quota: {
  userUsedBytes: number
  userQuotaBytes: number | null
  totalUsedBytes: number
  totalQuotaBytes: number
}) {
  let used = quota.userQuotaBytes != null ? quota.userUsedBytes : quota.totalUsedBytes
  let cap = quota.userQuotaBytes ?? quota.totalQuotaBytes
  let pct = cap > 0 ? Math.max(0, Math.min(1, used / cap)) : 0
  let near = pct >= 0.85
  return (
    <span
      role="progressbar"
      aria-label="Speicherkontingent"
      aria-valuemin={0}
      aria-valuemax={cap}
      aria-valuenow={Math.round(used)}
      mix={[quotaTrackCss, ...(near ? [quotaTrackNearCss] : [])]}
      data-quota-near={near ? 'true' : undefined}
    >
      <span
        mix={[quotaFillCss, ...(near ? [quotaFillNearCss] : [])]}
        style={{ width: `${pct * 100}%` }}
      />
    </span>
  )
}
