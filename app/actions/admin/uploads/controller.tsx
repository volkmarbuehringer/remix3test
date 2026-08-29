import { createController } from 'remix/router'
import { css } from 'remix/ui'
import { SuperHeaders } from 'remix/headers'
import { theme } from '../../../ui/theme/theme.ts'
import { routes } from '../../../routes.ts'
import { parseId } from '../../../utils/ids.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import {
  listUploads,
  claimUpload,
  getUploadDownload,
  type UploadRow,
} from '../../../data/uploads.ts'
import { PageSection, panelCss } from '../../../ui/page-primitives.tsx'
import { CsrfTokenInput } from '../../../ui/csrf-token-input.tsx'
import { getCurrentUser } from '../../../utils/context.ts'
import { takeUploadedId } from '../../../middleware/upload-claim.ts'
export default createController(routes.admin.uploads, {
  middleware: [requireAuth()],
  actions: {
    async index(context) {
      let user = getCurrentUser()
      let rows: UploadRow[] =
        user.role === 'admin'
          ? await listUploads(context.db)
          : await listUploads(context.db, user.id)
      return renderAdminPage(
        context.render,
        'uploads',
        <UploadsContent uploads={rows} uploadId={null} uploadError={null} />,
      )
    },

    async action(context) {
      let user = getCurrentUser()
      let uploadedId = takeUploadedId()
      let uploadId = uploadedId != null ? Number(uploadedId) : null

      let claimed =
        uploadId && !Number.isNaN(uploadId)
          ? await claimUpload(context.db, uploadId, user.id)
          : null

      let rows: UploadRow[] =
        user.role === 'admin'
          ? await listUploads(context.db)
          : await listUploads(context.db, user.id)
      let attemptedUpload =
        context.request.headers.get('Content-Type')?.startsWith('multipart/') ?? false
      let uploadError: string | null = null
      if (claimed === false) {
        uploadError =
          'Upload abgelehnt: Das Speicherkontingent ist erschöpft. Bitte löschen Sie alte Dateien.'
      } else if (uploadedId == null && attemptedUpload) {
        uploadError =
          'Upload fehlgeschlagen. Die Datei könnte zu groß sein oder der Server hatte einen Fehler.'
      }
      return renderAdminPage(
        context.render,
        'uploads',
        <UploadsContent
          uploads={rows}
          uploadId={claimed ? uploadId : null}
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
  uploadId: number | null
  uploadError: string | null
}

function UploadsContent(handle: { props: UploadsContentProps }) {
  return () => {
    let { uploads, uploadId, uploadError } = handle.props

    return (
      <PageSection
        title="Datei-Upload"
        description="Laden Sie Dateien hoch, die in der Datenbank gespeichert werden."
      >
        <div mix={panelCss}>
          {uploadId ? <p mix={successBanner}>Datei hochgeladen (ID: {uploadId}).</p> : null}
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
            <input type="file" name="file" required mix={fileInputCss} />
            <button type="submit" mix={submitCss}>
              Hochladen
            </button>
          </form>
        </div>

        {uploads.length > 0 ? (
          <div mix={panelCss}>
            <h2 mix={headingCss}>Hochgeladene Dateien</h2>
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
          </div>
        ) : null}
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
