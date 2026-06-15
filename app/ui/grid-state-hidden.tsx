import type { Handle } from 'remix/ui'
import type { GridState } from '../utils/grid-state.ts'

interface GridStateHiddenInputsProps {
  state: GridState
}

export function GridStateHiddenInputs(handle: Handle<GridStateHiddenInputsProps>) {
  return () => {
    let { state } = handle.props
    return (
      <>
        <input type="hidden" name="_offset" value={state.offset} />
        <input type="hidden" name="_sort" value={state.sort} />
        <input type="hidden" name="_order" value={state.order} />
        <input type="hidden" name="_filter" value={state.filter} />
        {state.period ? <input type="hidden" name="_period" value={state.period} /> : null}
        {state.status ? <input type="hidden" name="_status" value={state.status} /> : null}
      </>
    )
  }
}
