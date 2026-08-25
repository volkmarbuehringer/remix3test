import { clientEntry, on, type Handle, type SerializableProps } from 'remix/ui'
import button from '../../../ui/theme/button.ts'

interface DeletePastButtonProps extends SerializableProps {
  csrfToken: string
  offset: string
  sort: string
  order: string
  filter: string
  period: string
  status?: string
  pastCount: number
  deletePastHref: string
}

export const DeletePastButton = clientEntry(
  import.meta.url + '#DeletePastButton',
  function DeletePastButton(handle: Handle<DeletePastButtonProps>) {
    return () => {
      let { csrfToken, offset, sort, order, filter, period, status, pastCount, deletePastHref } =
        handle.props

      let clickHandler = on<HTMLButtonElement>('click', () => {
        let noun = pastCount === 1 ? 'vergangenes Angebot' : 'vergangene Angebote'
        if (!confirm(`Wirklich ${pastCount} ${noun} löschen?`)) return

        let form = document.createElement('form')
        form.method = 'POST'
        form.action = deletePastHref

        let addField = (name: string, value: string) => {
          let input = document.createElement('input')
          input.type = 'hidden'
          input.name = name
          input.value = value
          form.appendChild(input)
        }

        addField('_csrf', csrfToken)
        addField('_offset', offset)
        addField('_sort', sort)
        addField('_order', order)
        addField('_filter', filter)
        addField('_period', period)
        if (status) addField('_status', status)

        document.body.appendChild(form)
        form.submit()
        form.remove()
      })

      return (
        <button
          type="button"
          mix={[button({ tone: 'danger' }), clickHandler]}
          disabled={pastCount === 0}
          title={pastCount === 0 ? 'Keine vergangenen Angebote zu löschen.' : undefined}
        >
          Vergangene löschen{pastCount > 0 ? ` (${pastCount})` : ''}
        </button>
      )
    }
  },
)
