import { clientEntry, css, ref, type Handle, type SerializableProps } from 'remix/ui'

interface IntervalBoundsProps extends SerializableProps {
  startId: string
  endId: string
}

/**
 * ClientEntry that keeps an end-time select valid relative to a start-time select.
 *
 * Disables end options with a value <= the selected start and, when the user
 * lowers the start below the currently selected end, jumps to the first valid
 * end. This prevents the silent server-side `end <= start` rejection and makes
 * the constraint visible in the form itself.
 */
export const IntervalBounds = clientEntry(
  import.meta.url + '#IntervalBounds',
  function IntervalBounds(handle: Handle<IntervalBoundsProps>) {
    return () => {
      let { startId, endId } = handle.props

      return (
        <div
          mix={[
            css({ display: 'none' }),
            ref((el) => {
              let startEl = document.getElementById(startId) as HTMLSelectElement | null
              let endEl = document.getElementById(endId) as HTMLSelectElement | null
              if (!startEl || !endEl) return
              let start: HTMLSelectElement = startEl
              let end: HTMLSelectElement = endEl

              function sync() {
                let startMin = Number(start.value)
                let selectedEnd = Number(end.value)
                let foundSelected = false
                let firstValidEnd = startMin + 60

                for (let opt of Array.from(end.options)) {
                  let val = Number(opt.value)
                  let disabled = val <= startMin
                  opt.disabled = disabled
                  if (!disabled) {
                    if (opt.selected) foundSelected = true
                    if (firstValidEnd === startMin + 60) firstValidEnd = val
                  }
                }

                if (!foundSelected || selectedEnd <= startMin) {
                  end.value = String(firstValidEnd)
                }
              }

              start.addEventListener('change', sync)
              sync()

              handle.signal.addEventListener('abort', () => {
                start.removeEventListener('change', sync)
              })
            }),
          ]}
        />
      )
    }
  },
)
