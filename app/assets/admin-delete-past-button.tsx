import { clientEntry, on, type Handle, type SerializableProps } from 'remix/ui'
import { Button } from 'remix/ui/button'

interface DeletePastButtonProps extends SerializableProps {
  csrfToken: string
  offset: string
  sort: string
  order: string
  filter: string
  period: string
  status?: string
  deletePastHref: string
}

export const DeletePastButton = clientEntry(
  import.meta.url + '#DeletePastButton',
  function DeletePastButton(handle: Handle<DeletePastButtonProps>) {
    return () => {
      let { csrfToken, offset, sort, order, filter, period, status, deletePastHref } = handle.props

      let clickHandler = on<HTMLButtonElement>('click', () => {
        if (!confirm('Wirklich alle vergangenen Angebote löschen?')) return

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
        <Button type="button" tone="danger" mix={clickHandler}>
          Vergangene löschen
        </Button>
      )
    }
  },
)
