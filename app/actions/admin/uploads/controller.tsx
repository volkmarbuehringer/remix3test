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
  type UploadRow,
} from '../../../data/uploads.ts'
import { PageSection, panelCss } from '../../../ui/page-primitives.tsx'
import { CsrfTokenInput } from '../../../ui/csrf-token-input.tsx'
import { getCurrentUser } from '../../../utils/context.ts'
import { getPageSize } from '../../../utils/get-page-size.ts'
import { takeUploadedIds, takeUploadError } from '../../../middleware/upload-claim.ts'
import { table } from '../../../ui/mixins/admin-table.ts'

const UPLOADS_PAGE_SIZE = 20

function parseUploadPage(raw: string | null): number {
  let n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

function uploadErrorFromParam(code: string | null): string | null {
  if (!code) return null
  return uploadErrorMessages[code] ?? null
}

function uploadsPageHref(page: number): string {
  return `${routes.admin.uploads.index.href()}?page=${page}`
}

export default createController(routes.admin.uploads, {
  middleware: [requireAuth()],
  actions: {
    async index(context) {
      let user = getCurrentUser()
      let page = parseUploadPage(context.url.searchParams.get('page'))
      let uploadError = uploadErrorFromParam(context.url.searchParams.get('uploadError'))
      let pageSize = getPageSize(context.session, UPLOADS_PAGE_SIZE)
      let {
        rows,
        totalPages,
        page: effectivePage,
      } = await getUploadsPage(
        context.db,
        user.role === 'admin' ? undefined : user.id,
        page,
        pageSize,
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
}

function UploadsContent(handle: { props: UploadsContentProps }) {
  return () => {
    let { uploads, page, totalPages, uploadedIds, uploadError } = handle.props

    return (
      <PageSection
        title="Datei-Upload"
        description="Laden Sie Dateien hoch, die in der Datenbank gespeichert werden."
      >
        <div mix={panelCss}>
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
        </div>

        <div mix={panelCss}>
          <h2 mix={headingCss}>Hochgeladene Dateien</h2>
          {uploads.length > 0 ? (
            <table mix={tableCss}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Dateiname</th>
                  <th>Typ</th>
                  <th>Größe</th>
                  <th>Datum</th>
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
          ) : (
            <p mix={bodyTextCss}>Noch keine Dateien hochgeladen.</p>
          )}

          <div mix={paginationCss}>
            <span mix={table.paginationInfo}>
              Seite {page} von {totalPages}
            </span>
            <div mix={paginationButtonsCss}>
              {page > 1 ? (
                <a href={uploadsPageHref(page - 1)} mix={table.pageLink}>
                  Zurück
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>Zurück</span>
              )}
              {page < totalPages ? (
                <a href={uploadsPageHref(page + 1)} mix={table.pageLink}>
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

const headingCss = css({
  margin: '0 0 1rem',
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
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
    padding: theme.space.sm,
    textAlign: 'left',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  '& th': {
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.muted,
  },
})

const paginationCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.md,
  marginTop: theme.space.md,
})

const paginationButtonsCss = css({
  display: 'flex',
  gap: theme.space.sm,
})
