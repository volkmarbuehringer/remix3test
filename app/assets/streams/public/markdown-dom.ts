import { theme } from '../../../ui/theme/theme.ts'
import { parseMarkdown, type InlineToken } from '../../../utils/markdown.ts'

function renderInline(tokens: InlineToken[], parent: HTMLElement) {
  for (let token of tokens) {
    switch (token.type) {
      case 'text': {
        parent.appendChild(document.createTextNode(token.text))
        break
      }
      case 'bold': {
        let strong = document.createElement('strong')
        strong.style.fontWeight = '700'
        renderInline(token.children, strong)
        parent.appendChild(strong)
        break
      }
      case 'italic': {
        let em = document.createElement('em')
        renderInline(token.children, em)
        parent.appendChild(em)
        break
      }
      case 'code': {
        let code = document.createElement('code')
        code.textContent = token.text
        code.style.cssText =
          `font-family:${theme.fontFamily.mono};font-size:0.8em;` +
          `background:${theme.surface.lvl2};padding:0 0.25rem;border-radius:4px;`
        parent.appendChild(code)
        break
      }
      case 'link': {
        let anchor = document.createElement('a')
        anchor.href = token.href
        anchor.target = '_blank'
        anchor.rel = 'noreferrer noopener'
        anchor.textContent = token.text
        anchor.style.color = theme.colors.text.link
        anchor.style.textDecoration = 'underline'
        parent.appendChild(anchor)
        break
      }
    }
  }
}

export function renderMarkdownToDom(text: string): DocumentFragment {
  let fragment = document.createDocumentFragment()
  let blocks = parseMarkdown(text)

  for (let block of blocks) {
    switch (block.type) {
      case 'paragraph': {
        let p = document.createElement('p')
        p.style.margin = '0 0 0.5rem'
        renderInline(block.inline, p)
        fragment.appendChild(p)
        break
      }
      case 'heading': {
        let heading = document.createElement('div')
        heading.style.fontWeight = '600'
        heading.style.margin = '0.25rem 0 0.5rem'
        renderInline(block.inline, heading)
        fragment.appendChild(heading)
        break
      }
      case 'list': {
        let list = document.createElement(block.ordered ? 'ol' : 'ul')
        list.style.margin = '0 0 0.5rem'
        list.style.paddingLeft = '1.25rem'
        for (let item of block.items) {
          let li = document.createElement('li')
          renderInline(item, li)
          list.appendChild(li)
        }
        fragment.appendChild(list)
        break
      }
      case 'code': {
        let pre = document.createElement('pre')
        pre.style.cssText =
          `margin:0 0 0.5rem;padding:0.5rem;background:${theme.surface.lvl2};` +
          `border-radius:6px;font-family:${theme.fontFamily.mono};font-size:0.75rem;` +
          `white-space:pre-wrap;overflow-x:auto;`
        pre.textContent = block.text
        fragment.appendChild(pre)
        break
      }
      case 'hr': {
        let hr = document.createElement('hr')
        hr.style.border = 'none'
        hr.style.borderTop = `1px solid ${theme.colors.border.subtle}`
        hr.style.margin = '0.5rem 0'
        fragment.appendChild(hr)
        break
      }
    }
  }

  return fragment
}
