import { clientEntry, type Handle } from 'remix/ui'

export const WorkflowParameters = clientEntry(
  import.meta.url + '#WorkflowParameters',
  function WorkflowParametersEntry(handle: Handle) {
    let initialized = false

    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true

        let select = document.getElementById('workflow-select') as HTMLSelectElement | null
        let container = document.getElementById('parameters-container') as HTMLElement | null
        let list = document.getElementById('parameters-list') as HTMLElement | null
        if (!select || !container || !list) return null

        select.addEventListener('change', function () {
          let option = select!.options[select!.selectedIndex]
          let params: Array<{
            name: string
            required?: boolean
            description?: string
          }> = []

          try {
            params = JSON.parse(option.getAttribute('data-parameters') || '[]')
          } catch {
            params = []
          }

          if (params.length === 0) {
            container!.style.display = 'none'
            list!.innerHTML = ''
            return
          }

          container!.style.display = 'block'
          list!.innerHTML = ''

          for (let param of params) {
            let group = document.createElement('div')
            Object.assign(group.style, {
              display: 'flex',
              flexDirection: 'column',
              gap: '0.375rem',
            })

            let label = document.createElement('label')
            Object.assign(label.style, {
              fontSize: '0.8125rem',
              fontWeight: '500',
              color: 'var(--text-primary, #1e293b)',
            })
            label.textContent = param.name

            if (param.required) {
              let requiredSpan = document.createElement('span')
              requiredSpan.textContent = ' *'
              requiredSpan.style.color = '#dc2626'
              label.appendChild(requiredSpan)
            }

            let input = document.createElement('input')
            input.type = 'text'
            input.name = param.name
            Object.assign(input.style, {
              width: '100%',
              padding: '0.625rem 0.875rem',
              fontSize: '0.875rem',
              color: 'var(--text-primary, #1e293b)',
              background: 'var(--bg-primary, #fff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: 'var(--radius-sm, 6px)',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            })
            if (param.required) input.required = true
            if (param.description) input.placeholder = param.description

            group.appendChild(label)
            group.appendChild(input)
            list!.appendChild(group)
          }

          // Re-trigger fadeIn animation
          container!.style.animation = 'none'
          void container!.offsetHeight
          container!.style.animation = 'fadeIn 0.2s ease-out'
        })
      }

      return null
    }
  },
)
