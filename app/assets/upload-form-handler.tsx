import { clientEntry, ref, type Handle } from 'remix/ui'

export const UploadFormHandler = clientEntry(
  import.meta.url + '#UploadFormHandler',
  function UploadFormHandler(handle: Handle) {
    return () => (
      <div
        mix={ref((el) => {
          let form = document.getElementById('upload-form') as HTMLFormElement | null
          if (!form) return

          form.addEventListener('submit', async (e) => {
            e.preventDefault()

            let btn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null
            if (btn) {
              btn.disabled = true
              btn.textContent = 'Wird hochgeladen...'
            }

            try {
              let res = await fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
              })

              if (!res.ok) {
                console.error('Upload failed:', res.status, res.statusText)
              }
            } catch (err) {
              console.error('Upload failed:', err)
            }

            await handle.frame.reload()
          })
        })}
      />
    )
  },
)
