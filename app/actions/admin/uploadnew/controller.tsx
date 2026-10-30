import { createController } from 'remix/router'
import { css, type Handle } from 'remix/component'
import { createFileResponse } from 'remix/response/file'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../../routes.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import { bodyTextCss, PageSection, panelCss } from '../../../ui/page-primitives.tsx'
import { CsrfTokenInput } from '../../../ui/csrf-token-input.tsx'
import { ConfirmDelete } from '../../../ui/confirm-delete.browser.tsx'
import { theme } from '../../../ui/theme/theme.ts'
import { Glyph } from '../../../ui/theme/glyph/glyph.tsx'
import { RestfulForm } from '../../../ui/restful-form.tsx'
import {
  rowActions as rowActionsCss,
  iconAction as iconActionCss,
  iconActionDanger as iconActionDangerCss,
} from '../../../ui/mixins/row-actions.ts'
import { attachmentDisposition } from '../../../utils/content-disposition.ts'
import { formatCompactDateDE } from '../../../utils/date-utils.ts'
import { getSelfFrameTarget } from '../../../utils/frame-target.ts'
import { parseId } from '../../../utils/ids.ts'
import { uploadFiles } from '../../../storage.ts'
import {
  countUploadFiles,
  deleteUploadFile,
  getUploadFile,
  listUploadFiles,
  sumUploadFileBytesForUser,
  uploadFilesPerUserQuotaBytes,
  type UploadFileRow,
} from '../../../data/upload-files.ts'
import { getCurrentUserSafely } from '../../../utils/context.ts'
import {
  isMultipartForm,
  takeStoredFileKeys,
  takeUploadFilesError,
  UPLOAD_FILES_FIELD,
} from '../../../middleware/upload-files.ts'
import {
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  formatBytes,
  formatUploadType,
  uploadErrorMessages,
} from '../../../utils/upload-validation.ts'
import type { AppContext } from '../../../types/context.ts'

const UPLOAD_ACCEPT = [...ALLOWED_EXTENSIONS].join(',')

/** Rows shown on the page; the DB table is the paginatable source of truth. */
const LIST_LIMIT = 50

type UploadNewPageOptions = {
  uploadedCount?: number
  error?: string | null
}

/** Per-uploader quota state rendered next to the upload form. */
type UploadQuota = {
  usedBytes: number
  limitBytes: number
}

export default createController(routes.admin.uploadnew, {
  // The streaming parser runs globally (before route middleware), so the
  // admin half of this check is duplicated there to reject the request before
  // any bytes reach the filesystem.
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      return renderUploadNewPage(context, {
        error: uploadErrorFromParam(context.url.searchParams.get('uploadError')),
      })
    },

    async action(context) {
      // Keys come from the request scope, never from the submitted `file`
      // field: a client cannot report a key this request did not store.
      let storedKeys = takeStoredFileKeys()
      let error = takeUploadFilesError()

      if (storedKeys.length === 0 && error == null && isMultipartForm(context.request)) {
        error = 'Upload fehlgeschlagen. Bitte prüfen Sie Dateityp und Größe.'
      }

      return renderUploadNewPage(context, { uploadedCount: storedKeys.length, error })
    },

    // The frame commits the POST delete form action path as its address after
    // submission; a stale reload GETs it, so render the page instead of 404ing.
    async destroyResolve(context) {
      return renderUploadNewPage(context)
    },

    async destroy(context) {
      let id = parseId(context.params.id)
      if (id === undefined) {
        return new Response('Ungültige ID', {
          status: 400,
          headers: { 'Cache-Control': 'no-store' },
        })
      }

      // The DB row is the index; remove it first so a file-removal failure
      // leaves a reclaimable orphan rather than a row pointing at a missing
      // file. A filesystem orphan is recoverable by a later sweep.
      let storageKey = await deleteUploadFile(context.db, id)
      if (storageKey != null) {
        try {
          await uploadFiles.remove(storageKey)
        } catch (error) {
          if (process.env.NODE_ENV !== 'test') {
            console.error('Failed to remove stored upload', error)
          }
        }
      }

      return redirect(routes.admin.uploadnew.index.href())
    },

    async download(context) {
      let id = parseId(context.params.id)
      if (id === undefined) return notFound()

      let row = await getUploadFile(context.db, id)
      if (row == null) return notFound()

      let file: Awaited<ReturnType<typeof uploadFiles.get>>
      try {
        file = await uploadFiles.get(row.storage_key)
      } catch (error) {
        // A corrupt/missing `.meta.json` or unreadable `.dat` must degrade to a
        // 404 instead of an uncaught 500 for an otherwise healthy storage dir.
        if (process.env.NODE_ENV !== 'test') {
          console.error('Failed to read stored upload', error)
        }
        return notFound()
      }

      if (file == null) return notFound()

      let response = await createFileResponse(file, context.request, {
        // Admin-scoped uploads: keep them out of shared caches and revalidate
        // the stable URL with its ETag.
        cacheControl: 'private, no-cache',
      })
      // Uploaded content is always served as a download. `nosniff` alone does
      // not stop a browser from rendering HTML/SVG served from this origin.
      response.headers.set('Content-Disposition', attachmentDisposition(row.filename))
      return response
    },
  },
})

/**
 * Render the streaming upload page. Metadata comes from the `upload_files`
 * index (queryable, paginatable); the bytes stay in filesystem storage.
 */
async function renderUploadNewPage(
  context: Pick<AppContext, 'render' | 'db'>,
  options: UploadNewPageOptions = {},
): Promise<Response> {
  let [files, total, quota] = await Promise.all([
    listUploadFiles(context.db, { limit: LIST_LIMIT }),
    countUploadFiles(context.db),
    loadUploadQuota(context.db),
  ])

  return renderAdminPage(
    context.render,
    'uploadnew',
    <UploadNewPage
      files={files}
      total={total}
      uploadedCount={options.uploadedCount ?? 0}
      error={options.error ?? null}
      quota={quota}
    />,
  )
}

/**
 * Read the signed-in uploader's used bytes and configured limit. Returns
 * `null` when there is no session user (defensive: the page runs behind
 * requireAuth) or the aggregate is unreadable — the list must still render, and
 * the streaming handler's admission check stays authoritative either way.
 */
async function loadUploadQuota(db: AppContext['db']): Promise<UploadQuota | null> {
  let userId = getCurrentUserSafely()?.id
  if (userId == null) return null

  try {
    return {
      usedBytes: await sumUploadFileBytesForUser(db, userId),
      limitBytes: uploadFilesPerUserQuotaBytes(),
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Failed to measure the upload quota for the page', error)
    }
    return null
  }
}

/** Clamped integer percentage of the per-user cap already used. */
function quotaPercent(quota: UploadQuota): number {
  if (quota.limitBytes <= 0) return 100
  return Math.min(100, Math.round((quota.usedBytes / quota.limitBytes) * 100))
}

function uploadErrorFromParam(code: string | null): string | null {
  if (!code || !Object.hasOwn(uploadErrorMessages, code)) return null
  return uploadErrorMessages[code] ?? 'Upload fehlgeschlagen.'
}

/** 404 response for an unknown upload id or an unreadable stored file. */
function notFound(): Response {
  return new Response('Nicht gefunden', {
    status: 404,
    headers: { 'Cache-Control': 'no-store' },
  })
}

type UploadNewPageProps = {
  files: UploadFileRow[]
  total: number
  uploadedCount: number
  error: string | null
  quota: UploadQuota | null
}

function UploadNewPage(handle: Handle<UploadNewPageProps>) {
  return () => {
    let { files, total, uploadedCount, error, quota } = handle.props
    let limitBytes = quota?.limitBytes ?? uploadFilesPerUserQuotaBytes()

    return (
      <PageSection
        title="Datei-Upload (Dateisystem)"
        description="Dateien werden gestreamt im Dateisystem gespeichert; die Datenbank indiziert nur die Metadaten."
        mix={pageCss}
      >
        <div mix={[panelCss, panelGapCss]}>
          {uploadedCount > 0 ? (
            <p role="status" mix={successCss} data-upload-new-success>
              {uploadedCount === 1
                ? 'Datei erfolgreich im Dateisystem gespeichert.'
                : `${uploadedCount} Dateien erfolgreich im Dateisystem gespeichert.`}
            </p>
          ) : null}
          {error ? (
            <p role="alert" mix={errorCss}>
              {error}
            </p>
          ) : null}

          <form
            action={routes.admin.uploadnew.action.href()}
            method="POST"
            encType="multipart/form-data"
            mix={formCss}
          >
            <CsrfTokenInput />
            <label htmlFor="uploadnew-file" mix={labelCss}>
              Dateien auswählen
            </label>
            <input
              id="uploadnew-file"
              type="file"
              name={UPLOAD_FILES_FIELD}
              multiple
              accept={UPLOAD_ACCEPT}
              required
              aria-describedby="uploadnew-policy"
              mix={fileInputCss}
            />
            <p id="uploadnew-policy" mix={hintCss}>
              {`PDF, Bilder und Text · maximal ${formatBytes(MAX_UPLOAD_BYTES)} pro Datei, ` +
                `bis zu ${MAX_UPLOAD_FILES} Dateien pro Upload, ` +
                `insgesamt ${formatBytes(limitBytes)} pro Benutzer`}
            </p>
            <button type="submit" mix={submitCss}>
              Hochladen
            </button>
          </form>

          {quota ? (
            <p
              mix={quotaTextCss}
              data-uploadnew-quota
              title={`${formatBytes(Math.max(0, quota.limitBytes - quota.usedBytes))} frei`}
            >
              <Glyph name="info" width={14} height={14} />
              {`Ihr Speicher: ${formatBytes(quota.usedBytes)} von ${formatBytes(quota.limitBytes)} (${quotaPercent(quota)} %)`}
            </p>
          ) : null}
        </div>

        <div mix={panelCss}>
          <ConfirmDelete />
          <p mix={bodyTextCss}>
            {total === 0
              ? 'Noch keine Dateien im Dateisystem gespeichert.'
              : `${total} ${total === 1 ? 'Datei' : 'Dateien'} im Dateisystem` +
                (total > files.length ? ` · neueste ${files.length}` : '')}
          </p>
          {files.length > 0 ? (
            <div mix={tableWrapCss}>
              <table mix={tableCss} aria-label="Gespeicherte Dateien">
                <thead>
                  <tr>
                    <th mix={thCss}>Dateiname</th>
                    <th mix={thCss}>Typ</th>
                    <th mix={thCss}>Größe</th>
                    <th mix={thCss}>Gespeichert</th>
                    <th mix={thCss}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id} data-upload-new-row={file.id}>
                      <td mix={tdCss}>{file.filename}</td>
                      <td mix={tdCss}>{formatUploadType(file.mime_type)}</td>
                      <td mix={tdCss}>{formatBytes(file.size)}</td>
                      <td mix={tdCss}>
                        <span title={new Date(file.created_at).toLocaleString('de-DE')}>
                          {formatCompactDateDE(file.created_at)}
                        </span>
                      </td>
                      <td mix={tdCss}>
                        <div mix={rowActionsCss}>
                          <a
                            href={routes.admin.uploadnew.download.href({ id: file.id })}
                            download
                            data-download-link
                            data-rmx-target={getSelfFrameTarget()}
                            aria-label={`${file.filename} herunterladen`}
                            title="Datei herunterladen"
                            mix={iconActionCss}
                          >
                            <Glyph name="download" width={14} height={14} />
                          </a>
                          <RestfulForm
                            method="POST"
                            action={routes.admin.uploadnew.destroy.href({ id: file.id })}
                            data-delete-form={file.id}
                            data-confirm={`Datei "${file.filename}" wirklich löschen?`}
                            data-rmx-target={getSelfFrameTarget()}
                            mix={css({ margin: 0, padding: 0 })}
                          >
                            <button
                              type="submit"
                              aria-label={`${file.filename} löschen`}
                              title="Datei löschen"
                              mix={[iconActionCss, iconActionDangerCss]}
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
          ) : null}
        </div>
      </PageSection>
    )
  }
}

const pageCss = css({ maxWidth: '960px' })

const panelGapCss = css({ gap: theme.space.md })

const formCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  alignItems: 'flex-start',
})

const labelCss = css({
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const fileInputCss = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.secondary,
  maxWidth: '100%',
})

const hintCss = css({
  margin: 0,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

const quotaTextCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.xs,
  margin: 0,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

const submitCss = css({
  padding: `${theme.space.sm} ${theme.space.lg}`,
  border: 'none',
  borderRadius: theme.radius.md,
  backgroundColor: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  cursor: 'pointer',
  '&:hover': { backgroundColor: theme.colors.action.primary.backgroundHover },
})

const successCss = css({
  margin: 0,
  padding: theme.space.sm,
  borderRadius: theme.radius.md,
  backgroundColor: theme.colors.success.background,
  color: theme.colors.success.foreground,
  fontSize: theme.fontSize.sm,
})

const errorCss = css({
  margin: 0,
  padding: theme.space.sm,
  borderRadius: theme.radius.md,
  backgroundColor: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  fontSize: theme.fontSize.sm,
})

const tableWrapCss = css({ overflowX: 'auto' })

const tableCss = css({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: theme.fontSize.sm,
})

const thCss = css({
  textAlign: 'left',
  padding: theme.space.xs,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  color: theme.colors.text.secondary,
  fontWeight: theme.fontWeight.medium,
  whiteSpace: 'nowrap',
})

const tdCss = css({
  padding: theme.space.xs,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  color: theme.colors.text.primary,
})
