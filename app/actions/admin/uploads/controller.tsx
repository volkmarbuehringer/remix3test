import { createController } from 'remix/router'
import { css, type Handle } from 'remix/component'
import { ContentDisposition, SuperHeaders } from 'remix/headers'
import { createFileResponse } from 'remix/response/file'
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
  thIdCss,
  thTypeCss,
  thSizeCss,
  thDateCss,
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
  idCellCss,
  filenameCellCss,
  sizeCellCss,
  dateCellCss,
  mimeBadgeCss,
  emptyStateCss,
  emptyStateGlyph,
  dropzoneCss,
  dropzoneLabelCss,
  dropzoneHintCss,
  formRowCss,
  pendingListCss,
  validationErrorCss,
  quotaRowCss,
  quotaTextCss,
  quotaTrackCss,
  quotaTrackNearCss,
  quotaFillCss,
  quotaFillNearCss,
  clearSelectionBtnCss,
  uploadHintCss,
  pendingSummaryCss,
  pendingClearBtnCss,
  filenameTextCss,
  filenameMetaCss,
  pageSizeSlotCss,
  emptyActionCss,
  mobileSortCss,
  mobileSortLabelCss,
  mobileSortLinkCss,
  mobileSortLinkActiveCss,
  kindTabCss,
  kindCountCss,
  kindCountActiveCss,
  filenameLinkCss,
  pageNavCss,
  pageNumbersCss,
  pageNumberLinkCss,
  pageCurrentCss,
  pageGapCss,
} from './uploads-grid-css.ts'
import { routes } from '../../../routes.ts'
import { parseId } from '../../../utils/ids.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import {
  getUploadsPage,
  getUploadKindCounts,
  getUploadsQuotaUsage,
  uploadErrorMessages,
  claimUploads,
  getUploadDownload,
  getUploadsByIds,
  deleteUpload,
  deleteUploads,
  UPLOAD_SORT_FIELDS,
  UPLOAD_KINDS,
  isUploadKind,
  type UploadKind,
  type UploadRow,
} from '../../../data/uploads.ts'
import { buildZipArchive } from '../../../utils/zip.ts'
import { PageSection, panelCss } from '../../../ui/page-primitives.tsx'
import { CsrfTokenInput } from '../../../ui/csrf-token-input.tsx'
import { getCurrentUser } from '../../../utils/context.ts'
import {
  getPageSize,
  getPageSizeOverride,
  PAGE_SIZE_KEYS,
  type PageSizeKey,
} from '../../../utils/get-page-size.ts'
import { takeUploadedIds, takeUploadError } from '../../../middleware/upload-claim.ts'
import { PageSizeControl } from '../../../ui/page-size-control.tsx'
import { table } from '../../../ui/mixins/admin-table.ts'
import { sortArrow, sortRule } from '../../../ui/mixins/admin-urls.ts'
import { parseSort } from '../../../utils/sort-params.ts'
import { getSelfFrameTarget } from '../../../utils/frame-target.ts'
import { paginationWindow } from '../../../utils/pagination-window.ts'
import { formatCompactDateDE, formatRelativeTimeDE, MS_PER_DAY } from '../../../utils/date-utils.ts'
import {
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  formatUploadType,
  formatBytes,
} from '../../../utils/upload-validation.ts'
import { Glyph } from '../../../ui/theme/glyph/glyph.tsx'
import { RestfulForm } from '../../../ui/restful-form.tsx'
import { ConfirmDelete } from '../../../ui/confirm-delete.browser.tsx'
import { AdminUploadsContextMenu } from '../public/admin-uploads-context-menu.tsx'
import { UploadBulkDelete } from '../public/admin-uploads-bulk-delete.tsx'
import { UploadBulkDownload } from '../public/admin-uploads-bulk-download.tsx'
import { UploadDropzone } from '../public/admin-uploads-dropzone.tsx'
import { FilterAutoSubmit } from '../../../ui/filter-autosubmit.browser.tsx'
import { getQuotaStats, type QuotaStats } from './uploads-quota.ts'
import type { AppContext } from '../../../types/context.ts'

const UPLOADS_PAGE_SIZE = 15

/**
 * The file-picker `accept` list and full extension list come from the server
 * allowlist. The visible summary deliberately groups them into the same three
 * categories as the filter tabs, which is shorter and matches what users see in
 * the grid.
 */
const UPLOAD_ACCEPT = [...ALLOWED_EXTENSIONS].join(',')
const UPLOAD_FORMATS_LABEL = [...ALLOWED_EXTENSIONS]
  .map((extension) => extension.slice(1).toUpperCase())
  .join(', ')
const UPLOAD_POLICY_LABEL =
  `PDF, Bilder und Text · maximal ${formatBytes(MAX_UPLOAD_BYTES)} pro Datei, ` +
  `bis zu ${MAX_UPLOAD_FILES} Dateien pro Upload`

/**
 * German display label per MIME grouping. Typing this as `Record<UploadKind, …>`
 * keeps it exhaustive: adding a value to `UPLOAD_KINDS` fails typecheck until a
 * label exists, so the tabs can never drift from the query whitelist.
 */
const UPLOAD_KIND_LABELS: Record<UploadKind, string> = {
  pdf: 'PDF',
  image: 'Bilder',
  text: 'Text',
}

/**
 * Filter tabs for the uploads grid, derived from `UPLOAD_KINDS` so the query
 * whitelist is the single source of truth. `undefined` is "Alle".
 */
const UPLOAD_KIND_TABS: { value: UploadKind | undefined; label: string }[] = [
  { value: undefined, label: 'Alle' },
  ...UPLOAD_KINDS.map((value) => ({ value, label: UPLOAD_KIND_LABELS[value] })),
]

/**
 * Compact sort links for phones. The dedicated sortable columns (Typ, Größe,
 * Datum) are hidden below 720px to keep the grid readable, so this bar keeps
 * their sort toggle reachable without horizontal scrolling.
 */
const MOBILE_SORT_OPTIONS = [
  { field: 'created_at', label: 'Datum' },
  { field: 'filename', label: 'Name' },
  { field: 'size', label: 'Größe' },
  { field: 'mime_type', label: 'Typ' },
] as const

function parseUploadPage(raw: string | null): number {
  let n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/** URL `kind` parameter → a whitelisted MIME grouping, or undefined for "Alle". */
function parseUploadKind(raw: string | null): UploadKind | undefined {
  return isUploadKind(raw) ? raw : undefined
}

/** Display label for a whitelisted kind (used by the kind-aware empty state). */
function uploadKindLabel(kind: UploadKind): string {
  return UPLOAD_KIND_LABELS[kind]
}

function uploadErrorFromParam(code: string | null): string | null {
  if (!code) return null
  return uploadErrorMessages[code] ?? null
}

/**
 * Build an attachment `Content-Disposition` for an uploaded filename. Uploaded
 * names are user-controlled metadata, so keep the plain `filename` parameter
 * ASCII-only and carry non-ASCII names in the RFC 8187 `filename*` parameter.
 * `ContentDisposition` handles quoting/escaping; CR/LF are stripped earlier.
 */
function attachmentDisposition(filename: string): string {
  let asciiFilename = filename.replace(/[^\x20-\x7E]/g, '_')
  if (asciiFilename === filename) {
    return new ContentDisposition({ type: 'attachment', filename }).toString()
  }
  return new ContentDisposition({
    type: 'attachment',
    filename: asciiFilename,
    filenameSplat: `UTF-8''${encodeRfc8187(filename)}`,
  }).toString()
}

/** Percent-encode the characters RFC 8187 allows in an ext-value. */
function encodeRfc8187(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

/**
 * Build an uploads grid URL. The caller controls the page explicitly so a
 * filtering change can reset to page 1 while sort/search/kind are preserved.
 * Passing `deleted` also appends the post-delete banner count.
 */
function uploadsPageHref(
  page: number,
  sortColumn: string,
  sortDirection: 'asc' | 'desc',
  filter: string | undefined,
  kind: UploadKind | undefined,
  deleted?: number | undefined,
): string {
  let params = new URLSearchParams()
  params.set('page', String(page))
  params.set('sort', sortColumn)
  params.set('order', sortDirection)
  if (filter) params.set('filter', filter)
  if (kind) params.set('kind', kind)
  let base = `${routes.admin.uploads.index.href()}?${params.toString()}`
  return deleted !== undefined ? `${base}&deleted=${deleted}` : base
}

/** Sort-toggle link: flipping the sort resets to page 1 for a stable grid. */
function uploadsSortHref(
  field: string,
  currentSort: string,
  currentOrder: 'asc' | 'desc',
  filter: string | undefined,
  kind: UploadKind | undefined,
): string {
  let newOrder = field === currentSort ? (currentOrder === 'asc' ? 'desc' : 'asc') : 'asc'
  let params = new URLSearchParams()
  params.set('sort', field)
  params.set('order', newOrder)
  params.set('page', '1')
  if (filter) params.set('filter', filter)
  if (kind) params.set('kind', kind)
  return `${routes.admin.uploads.index.href()}?${params.toString()}`
}

/**
 * Kind-tab link. Selecting a MIME grouping always resets to page 1 — a stale
 * page can be out of range for the narrower result set — and keeps the active
 * search and sort.
 */
function uploadsKindHref(
  kind: UploadKind | undefined,
  sortColumn: string,
  sortDirection: 'asc' | 'desc',
  filter: string | undefined,
): string {
  return uploadsPageHref(1, sortColumn, sortDirection, filter, kind)
}

type UploadsGridOpts = {
  page?: number | undefined
  sortColumn?: string | undefined
  sortDirection?: 'asc' | 'desc' | undefined
  filter?: string | undefined
  kind?: UploadKind | undefined
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
  let kind =
    opts.kind !== undefined ? opts.kind : parseUploadKind(context.url.searchParams.get('kind'))
  let pageKey = PAGE_SIZE_KEYS.adminUploads
  let pageSize = getPageSize(context.session, UPLOADS_PAGE_SIZE, pageKey)
  let pageSizeOverride = getPageSizeOverride(context.session, pageKey)
  let { column, direction } = parseSort(context.url, {
    allowedColumns: UPLOAD_SORT_FIELDS,
    defaultColumn: 'created_at',
    defaultDirection: 'desc',
  })
  let sortColumn = opts.sortColumn ?? column
  let sortDirection = opts.sortDirection ?? direction
  // Admins see every upload; everyone else only the rows they claimed. The
  // counts query uses the same scope so the tab badges cannot drift from the grid.
  let ownerId = user.role === 'admin' ? undefined : user.id
  let [{ rows, total, totalPages, page: effectivePage }, quota, kindCounts] = await Promise.all([
    getUploadsPage(context.db, ownerId, page, pageSize, sortColumn, sortDirection, filter, kind),
    getUploadsQuotaUsage(context.db, ownerId),
    getUploadKindCounts(context.db, ownerId, filter),
  ])
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
      kind={kind}
      kindCounts={kindCounts}
      quota={quota}
      pageSize={pageSize}
      pageKey={pageKey}
      pageSizeOverride={pageSizeOverride}
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

      let { filename, mime_type, data, created_at } = row

      // Strip CR/LF so the filename cannot inject a header; quotes are safe
      // because ContentDisposition escapes them below.
      let cleanFilename = filename.replace(/[\r\n]/g, '')

      // `File` only accepts ArrayBuffer-backed BlobParts; copy the DB Buffer
      // (which is typed with an ArrayBufferLike) into a fresh Uint8Array.
      let file = new File([new Uint8Array(data)], cleanFilename, {
        type: mime_type,
        lastModified: created_at,
      })
      let response = await createFileResponse(file, context.request, {
        acceptRanges: true,
        // Downloads are owner-scoped; `private` keeps shared caches from
        // storing them, and `no-cache` revalidates the stable URL with its ETag.
        cacheControl: 'private, no-cache',
      })
      response.headers.set('Content-Disposition', attachmentDisposition(cleanFilename))
      return response
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
      zipHeaders.set('X-Content-Type-Options', 'nosniff')
      // The archive contains owner-scoped files; keep it out of shared caches.
      zipHeaders.set('Cache-Control', 'private, no-store')
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
      let kind = parseUploadKind(form.get('_kind') as string | null)

      return redirect(uploadsPageHref(page, sortColumn, sortDirection, filter, kind))
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
      let kind = parseUploadKind(form.get('_kind') as string | null)

      // Only carry the count (and thus the banner) when rows were actually
      // removed; omitting it for a no-op keeps the redirect URL clean.
      return redirect(
        uploadsPageHref(
          page,
          sortColumn,
          sortDirection,
          filter,
          kind,
          deleted > 0 ? deleted : undefined,
        ),
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
  kind: UploadKind | undefined
  /** Upload count per MIME grouping, scoped by the active search (see the tabs). */
  kindCounts: Record<UploadKind, number>
  pageSize: number
  pageKey: PageSizeKey
  pageSizeOverride: number | null
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
      kind,
      kindCounts,
      pageSize,
      pageKey,
      pageSizeOverride,
      quota,
    } = handle.props

    let quotaStats = getQuotaStats(quota)

    return (
      <PageSection
        title="Datei-Upload"
        description="PDF, Bilder und Textdateien hochladen, durchsuchen und verwalten."
        mix={pageSectionCss}
      >
        <div mix={[panelCss, uploadPanelCss]}>
          {uploadedIds.length > 0 ? (
            <p role="status" mix={successBanner} data-uploaded-banner>
              {uploadedIds.length === 1
                ? 'Datei erfolgreich hochgeladen.'
                : `${uploadedIds.length} Dateien erfolgreich hochgeladen.`}
            </p>
          ) : null}
          {deletedCount > 0 ? (
            <p role="status" mix={successBanner} data-deleted-banner>
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
            <div mix={formRowCss}>
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
                  accept={UPLOAD_ACCEPT}
                  aria-label="Dateien zum Hochladen auswählen"
                  aria-describedby="upload-policy-hint"
                  mix={fileInputCss}
                  data-file-input
                />
              </div>
              <button type="submit" mix={submitCss} data-upload-submit>
                <span data-upload-idle>
                  <Glyph name="send" width={14} height={14} /> Hochladen
                </span>
                <span data-upload-busy hidden aria-hidden="true">
                  <Glyph name="spinner" width={14} height={14} /> Hochladen …
                </span>
              </button>
            </div>
            <p
              id="upload-policy-hint"
              mix={uploadHintCss}
              title={`Erlaubte Dateitypen: ${UPLOAD_FORMATS_LABEL}`}
            >
              {UPLOAD_POLICY_LABEL}
            </p>
            <div mix={pendingSummaryCss} data-pending-summary hidden>
              <span data-pending-summary-text aria-live="polite"></span>
              <button type="button" mix={pendingClearBtnCss} data-pending-clear>
                Alle entfernen
              </button>
            </div>
            {/* The summary above carries the aria-live announcement; the chip
                list stays navigable without repeating every file name. */}
            <ul mix={pendingListCss} data-pending-list hidden></ul>
            <p role="alert" mix={validationErrorCss} data-upload-validation hidden></p>
            <UploadDropzone />
          </form>
          <div mix={quotaRowCss} role="group" aria-label="Speicherbelegung">
            <span
              mix={quotaTextCss}
              data-quota-summary
              title={`${formatBytes(quotaStats.free)} frei`}
            >
              <Glyph name="info" width={14} height={14} />
              {quotaStats.label}: {formatBytes(quotaStats.used)} von {formatBytes(quotaStats.cap)} (
              {quotaStats.percent} %)
            </span>
            {quotaBar(quotaStats)}
          </div>
          <div mix={toolsRowCss}>
            {/* `data-rmx-reset-focus="manual"` keeps the frame runtime from
                moving focus to the document after a live-search reload, so the
                auto-submit entry can put the caret back in the new input. */}
            <form
              method="GET"
              action={routes.admin.uploads.index.href()}
              data-rmx-target={getSelfFrameTarget()}
              data-uploads-filter
              data-rmx-reset-focus="manual"
              mix={filterBarCss}
            >
              {/* Kind tabs reset to page 1 — a stale page can be out of range for
                  the narrower result set — while preserving search and sort. */}
              <span
                mix={table.filterGroup}
                data-kind-tabs
                role="group"
                aria-label="Nach Dateityp filtern"
              >
                {UPLOAD_KIND_TABS.map((tab) => {
                  // The active tab's count is the filtered total; the others
                  // count the same search under each kind, so the badges always
                  // add up to the "Alle" tab.
                  let active = kind === tab.value
                  let count = tab.value ? kindCounts[tab.value] : total
                  return (
                    <a
                      key={tab.label}
                      href={uploadsKindHref(tab.value, sortColumn, sortDirection, filter)}
                      data-rmx-target={getSelfFrameTarget()}
                      aria-current={active ? 'true' : undefined}
                      aria-label={`${tab.label}: ${count} ${count === 1 ? 'Datei' : 'Dateien'}`}
                      mix={[
                        table.filterTab,
                        kindTabCss,
                        active ? table.filterTabActive : undefined,
                      ]}
                    >
                      {tab.label}
                      <span
                        aria-hidden="true"
                        mix={[kindCountCss, active ? kindCountActiveCss : undefined]}
                      >
                        {count}
                      </span>
                    </a>
                  )
                })}
              </span>
              <input type="hidden" name="page" value="1" />
              <input type="hidden" name="sort" value={sortColumn} />
              <input type="hidden" name="order" value={sortDirection} />
              {kind ? <input type="hidden" name="kind" value={kind} /> : null}
              <input
                type="search"
                name="filter"
                placeholder="Suche nach Dateiname oder Typ…"
                defaultValue={filter ?? ''}
                aria-label="Dateien nach Name oder Typ durchsuchen"
                autoComplete="off"
                enterKeyHint="search"
                mix={table.filterInput}
              />
              <button type="submit" mix={table.searchBtn}>
                <Glyph name="search" width={14} height={14} /> Suchen
              </button>
              {filter || kind ? (
                <a
                  href={routes.admin.uploads.index.href()}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={table.clearLink}
                >
                  Zurücksetzen
                </a>
              ) : null}
              {/* The sortable Typ/Größe/Datum headers are hidden on phones, so
                  keep their sort toggles here instead. */}
              <span mix={mobileSortCss} data-mobile-sort>
                <span mix={mobileSortLabelCss}>Sortieren:</span>
                {MOBILE_SORT_OPTIONS.map((option) => {
                  let active = sortColumn === option.field
                  return (
                    <a
                      key={option.field}
                      href={uploadsSortHref(option.field, sortColumn, sortDirection, filter, kind)}
                      data-rmx-target={getSelfFrameTarget()}
                      aria-label={`Nach ${option.label} sortieren`}
                      mix={[mobileSortLinkCss, active ? mobileSortLinkActiveCss : undefined]}
                    >
                      {option.label}
                      <span aria-hidden="true">
                        {sortArrow(option.field, sortColumn, sortDirection)}
                      </span>
                    </a>
                  )
                })}
              </span>
            </form>
            {/* Debounced live search: typing re-runs the current filter instead
                of waiting for the "Suchen" button (which stays for the no-JS
                path). */}
            <FilterAutoSubmit formSelector="form[data-uploads-filter]" />
            {uploads.length > 0 ? (
              <div mix={bulkGroupCss} data-bulk-group>
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
                    kind={kind}
                  />
                  <div mix={bulkToolbarCss}>
                    <span mix={selectedCountCss} data-selected-count aria-live="polite">
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
              <table
                mix={tableCss}
                aria-label="Hochgeladene Dateien"
                data-uploads-table="true"
                data-selection-scope={`${kind ?? ''}::${filter ?? ''}`}
              >
                <thead>
                  <tr>
                    <th mix={thCheckboxCss}>
                      <input
                        type="checkbox"
                        data-select-all
                        aria-label="Alle Dateien auf dieser Seite auswählen"
                      />
                    </th>
                    <th aria-sort={sortRule('id', sortColumn, sortDirection)} mix={thIdCss}>
                      <a
                        href={uploadsSortHref('id', sortColumn, sortDirection, filter, kind)}
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
                        href={uploadsSortHref('filename', sortColumn, sortDirection, filter, kind)}
                        data-rmx-target={getSelfFrameTarget()}
                        mix={sortLinkCss}
                      >
                        Dateiname
                        <span mix={sortColumn === 'filename' ? sortArrowActiveCss : sortArrowCss}>
                          {sortArrow('filename', sortColumn, sortDirection)}
                        </span>
                      </a>
                    </th>
                    <th
                      aria-sort={sortRule('mime_type', sortColumn, sortDirection)}
                      mix={thTypeCss}
                    >
                      <a
                        href={uploadsSortHref('mime_type', sortColumn, sortDirection, filter, kind)}
                        data-rmx-target={getSelfFrameTarget()}
                        mix={sortLinkCss}
                      >
                        Typ
                        <span mix={sortColumn === 'mime_type' ? sortArrowActiveCss : sortArrowCss}>
                          {sortArrow('mime_type', sortColumn, sortDirection)}
                        </span>
                      </a>
                    </th>
                    <th aria-sort={sortRule('size', sortColumn, sortDirection)} mix={thSizeCss}>
                      <a
                        href={uploadsSortHref('size', sortColumn, sortDirection, filter, kind)}
                        data-rmx-target={getSelfFrameTarget()}
                        mix={sortLinkCss}
                      >
                        Größe
                        <span mix={sortColumn === 'size' ? sortArrowActiveCss : sortArrowCss}>
                          {sortArrow('size', sortColumn, sortDirection)}
                        </span>
                      </a>
                    </th>
                    <th
                      aria-sort={sortRule('created_at', sortColumn, sortDirection)}
                      mix={thDateCss}
                    >
                      <a
                        href={uploadsSortHref(
                          'created_at',
                          sortColumn,
                          sortDirection,
                          filter,
                          kind,
                        )}
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
                    <tr
                      key={u.id}
                      data-row-id={u.id}
                      data-upload-filename={u.filename}
                      data-uploaded={uploadedIds.includes(u.id) ? 'true' : undefined}
                    >
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
                      <td mix={filenameCellCss} title={u.filename}>
                        {/* The name is the row's primary affordance: clicking it
                            downloads the file, so users do not have to discover
                            the small download button in the actions column. */}
                        <a
                          href={routes.admin.uploads.download.href({ id: u.id })}
                          download
                          data-filename-link
                          aria-label={`${u.filename} herunterladen`}
                          mix={[filenameTextCss, filenameLinkCss]}
                        >
                          {u.filename}
                        </a>
                        {/* Narrow screens hide the Typ/Größe/Datum columns; this
                            line keeps that metadata visible without the grid
                            scrolling sideways. */}
                        <span mix={filenameMetaCss}>
                          <span mix={mimeBadgeCss} title={u.mime_type}>
                            {formatUploadType(u.mime_type)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatBytes(u.size)}</span>
                          <span aria-hidden="true">·</span>
                          {/* Compact date instead of the weekday-prefixed
                              absolute fallback, so the meta line fits a phone. */}
                          <span title={new Date(u.created_at).toLocaleString('de-DE')}>
                            {formatUploadMetaDate(u.created_at)}
                          </span>
                        </span>
                      </td>
                      <td>
                        <span mix={mimeBadgeCss} data-mime={u.mime_type} title={u.mime_type}>
                          {formatUploadType(u.mime_type)}
                        </span>
                      </td>
                      <td mix={sizeCellCss}>{formatBytes(u.size)}</td>
                      <td mix={dateCellCss}>
                        <span title={new Date(u.created_at).toLocaleString('de-DE')}>
                          {formatRelativeTimeDE(u.created_at)}
                        </span>
                      </td>
                      <td mix={tdActionsCss}>
                        <div mix={rowActionsCss}>
                          <a
                            href={routes.admin.uploads.download.href({ id: u.id })}
                            download
                            data-download-link
                            data-rmx-target={getSelfFrameTarget()}
                            mix={iconActionCss}
                            aria-label={`${u.filename} herunterladen`}
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
                              kind={kind}
                            />
                            <button
                              type="submit"
                              mix={[iconActionCss, iconActionDangerCss]}
                              aria-label={`${u.filename} löschen`}
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
                {filter && kind
                  ? 'Keine Dateien für diese Suche und diesen Typ gefunden.'
                  : filter
                    ? 'Keine Dateien gefunden für diese Suche.'
                    : kind
                      ? `Keine Dateien vom Typ „${uploadKindLabel(kind)}“ gefunden.`
                      : 'Noch keine Dateien hochgeladen. Ziehen Sie eine Datei hierher oder wählen Sie eine aus.'}
              </p>
              {filter || kind ? (
                <a
                  href={uploadsPageHref(1, sortColumn, sortDirection, undefined, undefined)}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={emptyActionCss}
                >
                  Filter zurücksetzen
                </a>
              ) : null}
            </div>
          )}

          <div mix={paginationCss}>
            <span mix={table.paginationInfo} data-pagination-info>
              {total === 0 ? 'Keine Dateien' : `${total} Dateien · Seite ${page} von ${totalPages}`}
            </span>
            <div mix={paginationButtonsCss}>
              {total > 0 ? (
                <nav mix={pageNavCss} aria-label="Seitennavigation">
                  {page > 1 ? (
                    <a
                      href={uploadsPageHref(page - 1, sortColumn, sortDirection, filter, kind)}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.pageLink}
                      aria-label="Vorherige Seite"
                    >
                      Zurück
                    </a>
                  ) : (
                    <span mix={table.pageLinkDisabled}>Zurück</span>
                  )}
                  {/* Direct page links: jumping to a page should not require
                      stepping through every page with "Vor". The window shrinks
                      to a few neighbours plus the first/last page. */}
                  {totalPages > 1 ? (
                    <span mix={pageNumbersCss}>
                      {paginationWindow(page, totalPages).map((entry, index) =>
                        entry === 'gap' ? (
                          <span key={`gap-${index}`} aria-hidden="true" mix={pageGapCss}>
                            …
                          </span>
                        ) : entry === page ? (
                          <span key={`page-${entry}`} aria-current="page" mix={pageCurrentCss}>
                            {entry}
                          </span>
                        ) : (
                          <a
                            key={`page-${entry}`}
                            href={uploadsPageHref(entry, sortColumn, sortDirection, filter, kind)}
                            data-rmx-target={getSelfFrameTarget()}
                            aria-label={`Seite ${entry}`}
                            mix={[table.pageLink, pageNumberLinkCss]}
                          >
                            {entry}
                          </a>
                        ),
                      )}
                    </span>
                  ) : null}
                  {page < totalPages ? (
                    <a
                      href={uploadsPageHref(page + 1, sortColumn, sortDirection, filter, kind)}
                      data-rmx-target={getSelfFrameTarget()}
                      mix={table.pageLink}
                      aria-label="Nächste Seite"
                    >
                      Vor
                    </a>
                  ) : (
                    <span mix={table.pageLinkDisabled}>Vor</span>
                  )}
                </nav>
              ) : null}
              <div mix={pageSizeSlotCss}>
                <PageSizeControl
                  action={routes.admin.pageSize.href()}
                  pageKey={pageKey}
                  pageSize={pageSize}
                  pageSizeOverride={pageSizeOverride}
                  controlId="uploads-page-size"
                />
              </div>
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
  kind: UploadKind | undefined
}

/** Carries the uploads grid state through a delete submit so the post-delete
 * redirect lands back on the same page/sort/order/filter/kind view. Unlike the
 * shared {@link GridStateHiddenInputs} (offset-based), uploads paginates by
 * page number, so it emits `_page` instead of `_offset`. */
function UploadsGridStateHiddenInputs(handle: Handle<UploadsGridStateHiddenInputsProps>) {
  return () => {
    let { page, sortColumn, sortDirection, filter, kind } = handle.props
    return (
      <>
        <input type="hidden" name="_page" value={page} />
        <input type="hidden" name="_sort" value={sortColumn} />
        <input type="hidden" name="_order" value={sortDirection} />
        <input type="hidden" name="_filter" value={filter ?? ''} />
        <input type="hidden" name="_kind" value={kind ?? ''} />
      </>
    )
  }
}

/**
 * Date shown in the narrow-screen filename meta line. Keeps the relative
 * wording for recent uploads but uses the compact `03.10.2026` form for older
 * ones, because the weekday-prefixed `Sa., 03.10.2026` fallback wraps onto a
 * second line inside a phone-sized filename column.
 */
function formatUploadMetaDate(createdAt: number): string {
  if (Date.now() - createdAt < 7 * MS_PER_DAY) return formatRelativeTimeDE(createdAt)
  return formatCompactDateDE(createdAt)
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

/**
 * Storage-usage progress bar with a human-readable value for assistive tech;
 * turns warning-coloured near the limit.
 */
function quotaBar(stats: QuotaStats) {
  return (
    <span
      role="progressbar"
      aria-label="Speicherkontingent"
      aria-valuemin={0}
      aria-valuemax={stats.cap}
      aria-valuenow={Math.round(stats.used)}
      aria-valuetext={`${formatBytes(stats.used)} von ${formatBytes(stats.cap)} (${stats.percent} %)`}
      mix={[quotaTrackCss, ...(stats.near ? [quotaTrackNearCss] : [])]}
      data-quota-near={stats.near ? 'true' : undefined}
    >
      <span
        mix={[quotaFillCss, ...(stats.near ? [quotaFillNearCss] : [])]}
        style={{ width: `${stats.ratio * 100}%` }}
      />
    </span>
  )
}
