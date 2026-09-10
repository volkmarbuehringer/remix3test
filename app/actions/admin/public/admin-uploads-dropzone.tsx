import { clientEntry, css, ref, type Handle } from 'remix/ui'
import { validateUploadFiles, formatBytes } from '../../../utils/upload-validation.ts'
import { theme } from '../../../ui/theme/theme.ts'

// Inline-style objects. remix/ui `css()` mixins cannot be applied to elements
// created at runtime (no frame render handle), so the dynamically-rendered
// pending-file chips use plain styles instead. The typed `theme` tokens already
// carry their `var()` wrapper, so assign them directly: wrapping them again
// yields a doubly-wrapped reference, which the CSS parser drops and leaves the
// chips unstyled.
const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '0.2rem 0.5rem',
  fontSize: '0.75rem',
  background: theme.surface.lvl3,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: '999px',
  whiteSpace: 'nowrap',
} as const

const chipNameStyle = {
  maxWidth: '220px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const

const chipSizeStyle = {
  color: theme.colors.text.muted,
} as const

const chipRemoveStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '16px',
  height: '16px',
  padding: 0,
  border: 'none',
  borderRadius: '999px',
  background: 'transparent',
  color: theme.colors.text.muted,
  cursor: 'pointer',
  fontWeight: 'bold',
  lineHeight: 1,
} as const

/**
 * ClientEntry that enhances the uploads upload form (`[data-upload-form]`):
 *
 * - turns the dropzone into a drag-and-drop target that adds dropped files to the
 *   hidden file input,
 * - makes the whole dashed box open the file picker (it already renders with
 *   `cursor: pointer`), not just the label,
 * - swallows drops landing anywhere else on the page, so the browser does not
 *   navigate away to open the dropped file,
 * - renders a pending-file chip list (name, size, remove) below the dropzone,
 * - validates the batch client-side (type, count, per-file size) so invalid files
 *   fail fast instead of after a full multipart round-trip,
 * - blocks the submit until a valid file is selected and shows an in-flight
 *   "Hochladen…" state with a double-submit guard.
 *
 * The real `<input type="file" name="file" multiple>` stays server-rendered, so
 * the native/Frame submission path, CSRF and server-side validation are
 * unchanged — this entry only adds the UI layer on top. `required` is left off
 * the input and the empty-selection case is handled here (and, as a no-JS
 * fallback, by the server's "Upload fehlgeschlagen" banner).
 */
export const UploadDropzone = clientEntry(
  import.meta.url + '#UploadDropzone',
  function UploadDropzone(handle: Handle) {
    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((_el) => {
            let formNode = document.querySelector<HTMLFormElement>('[data-upload-form]')
            if (!formNode) return
            let form = formNode
            let input = form.querySelector<HTMLInputElement>('[data-file-input]')!
            let dropzone = form.querySelector<HTMLElement>('[data-dropzone]')!
            let list = form.querySelector<HTMLUListElement>('[data-pending-list]')!
            let validation = form.querySelector<HTMLElement>('[data-upload-validation]')!
            let submit = form.querySelector<HTMLButtonElement>('[data-upload-submit]')!

            let uploading = false

            function selectedFiles(): File[] {
              return Array.from(input.files ?? [])
            }

            function fileKey(file: File): string {
              return `${file.name}:${file.size}:${file.lastModified}`
            }

            function setBusy(busy: boolean) {
              uploading = busy
              if (busy) form.dataset.uploading = 'true'
              else delete form.dataset.uploading
              dropzone.toggleAttribute('data-disabled', busy)
              submit.setAttribute('aria-busy', String(busy))
              let idle = submit.querySelector('[data-upload-idle]')
              let busyEl = submit.querySelector('[data-upload-busy]')
              if (idle) idle.toggleAttribute('hidden', busy)
              if (busyEl) busyEl.toggleAttribute('hidden', !busy)
              if (busy) {
                // Defer the disable until after the submit event has fully
                // propagated, so the Frame runtime reads the submitter while it is
                // still enabled (independent of listener registration order). The
                // button stays disabled until the frame re-renders the form.
                setTimeout(() => {
                  submit.disabled = true
                }, 0)
              } else {
                submit.disabled = false
              }
            }

            function syncSubmitState(files: File[]) {
              let error = validateUploadFiles(
                files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
              )
              if (error) {
                validation.textContent = error
                validation.removeAttribute('hidden')
              } else {
                validation.textContent = ''
                validation.setAttribute('hidden', '')
              }
              // Enable the submit button only when a valid batch is selected and an
              // upload is not already in flight.
              return files.length > 0 && error == null && !uploading
            }

            function renderPending() {
              let files = selectedFiles()
              list.innerHTML = ''
              if (files.length === 0) {
                list.setAttribute('hidden', '')
              } else {
                list.removeAttribute('hidden')
              }

              for (let [i, file] of files.entries()) {
                let li = document.createElement('li')
                Object.assign(li.style, chipStyle)
                li.setAttribute('data-pending-file', String(file.size))

                let name = document.createElement('span')
                Object.assign(name.style, chipNameStyle)
                name.textContent = file.name
                li.appendChild(name)

                let size = document.createElement('span')
                Object.assign(size.style, chipSizeStyle)
                size.textContent = formatBytes(file.size)
                li.appendChild(size)

                let remove = document.createElement('button')
                remove.type = 'button'
                Object.assign(remove.style, chipRemoveStyle)
                remove.setAttribute('aria-label', `${file.name} entfernen`)
                remove.textContent = '×'
                remove.addEventListener('click', () => removeFile(i))
                li.appendChild(remove)

                list.appendChild(li)
              }

              submit.disabled = !syncSubmitState(files)
            }

            function setInputFiles(files: File[]) {
              let dt = new DataTransfer()
              for (let file of files) dt.items.add(file)
              input.files = dt.files
            }

            function removeFile(index: number) {
              let files = selectedFiles()
              if (index >= files.length) return
              files.splice(index, 1)
              setInputFiles(files)
              renderPending()
            }

            function addFiles(incoming: FileList) {
              let current = Array.from(selectedFiles())
              let keys = new Set(current.map(fileKey))
              for (let file of Array.from(incoming)) {
                if (!keys.has(fileKey(file))) {
                  current.push(file)
                  keys.add(fileKey(file))
                }
              }
              setInputFiles(current)
              renderPending()
            }

            function onChange() {
              renderPending()
            }

            function onSubmit(event: Event) {
              let files = selectedFiles()

              if (files.length === 0) {
                validation.textContent = 'Keine Dateien ausgewählt.'
                validation.removeAttribute('hidden')
                event.preventDefault()
                return
              }

              let error = validateUploadFiles(
                files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
              )
              if (error) {
                validation.textContent = error
                validation.removeAttribute('hidden')
                event.preventDefault()
                return
              }

              // Double-submit guard: the Frame runtime handles the first valid
              // submission; any further submit while it is in flight is blocked.
              if (uploading) {
                event.preventDefault()
                return
              }
              setBusy(true)
            }

            function onDragOver(event: Event) {
              event.preventDefault()
              dropzone.dataset.dragover = 'true'
            }

            function onDragLeave(event: Event) {
              event.preventDefault()
              delete dropzone.dataset.dragover
            }

            function onDrop(event: Event) {
              event.preventDefault()
              delete dropzone.dataset.dragover
              let data = (event as DragEvent).dataTransfer
              if (data && data.files.length > 0) addFiles(data.files)
            }

            // The dashed box already shows `cursor: pointer`, so clicking anywhere
            // in it should open the picker like the label does. Clicks routed
            // through the label (or the input itself) are left to the native
            // behaviour, otherwise the picker would open twice.
            function onDropzoneClick(event: Event) {
              let target = event.target as HTMLElement | null
              if (target && (target.closest('label') || target === input)) return
              event.preventDefault()
              input.click()
            }

            // Drops outside the dropzone fall through to the browser, which would
            // navigate away and open the file. Cancel those and say where the file
            // should go instead.
            //
            // Only drags that actually carry files are cancelled: cancelling
            // `dragover` is what marks an element as a valid drop target, so
            // doing it for every drag would also swallow unrelated native drops
            // (e.g. dragging selected text into the search field).
            function carriesFiles(event: DragEvent): boolean {
              return Array.from(event.dataTransfer?.types ?? []).includes('Files')
            }

            function onDocumentDragOver(event: DragEvent) {
              if (carriesFiles(event)) event.preventDefault()
            }

            function onDocumentDrop(event: DragEvent) {
              if (!carriesFiles(event)) return
              event.preventDefault()
              let target = event.target as Node | null
              if (target && dropzone.contains(target)) return
              validation.textContent = 'Bitte Dateien in das Feld oben ziehen.'
              validation.removeAttribute('hidden')
            }

            input.addEventListener('change', onChange)
            dropzone.addEventListener('dragover', onDragOver)
            dropzone.addEventListener('dragenter', onDragOver)
            dropzone.addEventListener('dragleave', onDragLeave)
            dropzone.addEventListener('drop', onDrop)
            dropzone.addEventListener('click', onDropzoneClick)
            document.addEventListener('dragover', onDocumentDragOver)
            document.addEventListener('drop', onDocumentDrop)
            form.addEventListener('submit', onSubmit)

            renderPending()

            // Hydration signal for e2e: the clientEntry attaches listeners
            // asynchronously after the form renders, so tests wait for this
            // attribute before interacting to avoid a hydration race.
            form.dataset.dropzoneReady = 'true'

            handle.signal.addEventListener('abort', () => {
              input.removeEventListener('change', onChange)
              dropzone.removeEventListener('dragover', onDragOver)
              dropzone.removeEventListener('dragenter', onDragOver)
              dropzone.removeEventListener('dragleave', onDragLeave)
              dropzone.removeEventListener('drop', onDrop)
              dropzone.removeEventListener('click', onDropzoneClick)
              document.removeEventListener('dragover', onDocumentDragOver)
              document.removeEventListener('drop', onDocumentDrop)
              form.removeEventListener('submit', onSubmit)
            })
          }),
        ]}
      />
    )
  },
)
