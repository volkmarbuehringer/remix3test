export function setupAutoGrowTextarea(
  textarea: HTMLTextAreaElement,
  options: { signal?: AbortSignal; maxHeight?: number } = {},
): { reset: () => void } {
  let maxHeight = options.maxHeight ?? 160

  function grow() {
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px'
  }

  textarea.addEventListener('input', grow, options.signal !== undefined ? { signal: options.signal } : undefined)

  return {
    reset() {
      textarea.style.height = ''
    },
  }
}
