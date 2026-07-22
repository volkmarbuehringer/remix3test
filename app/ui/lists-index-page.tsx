import { type Handle } from 'remix/ui'
import { ListsClient } from '../actions/lists/lists-client.browser.tsx'

type ListInitState = {
  id: number
  description: string
  items: Array<{ id: string; label: string }>
  updated_at: number
} | null

type ListsIndexPageProps = {
  initialState?: ListInitState
}

export function ListsIndexPage(handle: Handle<ListsIndexPageProps>) {
  return () => {
    let { initialState } = handle.props
    return (
      <>
        <div
          id="lists-initial-state"
          hidden
          data-state={initialState ? JSON.stringify(initialState) : ''}
        />
        <ListsClient initialState={initialState ?? null} />
      </>
    )
  }
}
