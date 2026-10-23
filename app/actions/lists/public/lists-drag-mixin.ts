import { createMixin } from 'remix/component'

import { createListsDrag, wireListsDragHost, type ListsDragContext } from './lists-drag.ts'

/**
 * Browser-only `drag()` mixin (`createMixin(..., { ssr: false })`): applies
 * the /lists drag-and-drop behavior to the element-list container. The server
 * skips both setup and render — the behavior contributes no server HTML (the
 * per-row `ref()` wiring it replaces was browser-only too), so the SSR output
 * is unchanged.
 *
 * The factory argument is the controller context (the callbacks bridging the
 * drag state to the editor's closure state). Pass the *same* context object on
 * every render — the client builds it once outside its render function; the
 * controller is created on the first render call and keeps that context. On
 * `insert` the delegated wiring (`wireListsDragHost`) is bound to the host
 * node; a replaced host takes its old listeners with it and the fresh node is
 * wired anew. Listener teardown is owned by the mixin slot's scope signal.
 */
export const drag = createMixin<HTMLElement, [ListsDragContext]>(
  (handle) => {
    let signal = handle.signal
    let controller: ReturnType<typeof createListsDrag> | null = null
    let currentNode: HTMLElement | null = null
    let wiredNode: HTMLElement | null = null

    handle.addEventListener('insert', (event) => {
      let node = event.node as HTMLElement
      currentNode = node
      if (controller && node !== wiredNode) {
        wiredNode = node
        wireListsDragHost(node, controller, signal)
      }
    })

    handle.addEventListener('remove', () => {
      currentNode = null
      wiredNode = null
    })

    return (ctx: ListsDragContext) => {
      controller ??= createListsDrag(ctx)
      if (currentNode && currentNode !== wiredNode) {
        wiredNode = currentNode
        wireListsDragHost(currentNode, controller, signal)
      }
      return handle.element
    }
  },
  { ssr: false },
)

export type ListsDragMixinDescriptor = ReturnType<typeof drag>
