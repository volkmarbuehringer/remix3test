import { css, Fragment, type Handle } from 'remix/component'
import { theme } from './theme/theme.ts'
import { parseMarkdown, type InlineToken, type MarkdownBlock } from '../utils/markdown.ts'

// Static rules from the chat markdown renderer. All values here are constant,
// so they go through css() (collected/deduplicated into the document head by
// the server renderer) instead of inline style attributes. The inline <strong>
// font-weight is defensive: the theme reset zeroes margins but user agents
// honor it anyway when the reset ships without a strong rule.
const boldCss = css({
  fontWeight: 700,
})

const codeCss = css({
  fontFamily: theme.fontFamily.mono,
  fontSize: '0.8em',
  background: theme.surface.lvl2,
  padding: '0 0.25rem',
  borderRadius: '4px',
})

const linkCss = css({
  color: theme.colors.text.link,
  textDecoration: 'underline',
})

const paragraphCss = css({
  margin: '0 0 0.5rem',
})

const headingCss = css({
  fontWeight: 600,
  margin: '0.25rem 0 0.5rem',
})

const listCss = css({
  margin: '0 0 0.5rem',
  paddingLeft: '1.25rem',
})

const preCss = css({
  margin: '0 0 0.5rem',
  padding: '0.5rem',
  background: theme.surface.lvl2,
  borderRadius: '6px',
  fontFamily: theme.fontFamily.mono,
  fontSize: '0.75rem',
  whiteSpace: 'pre-wrap',
  overflowX: 'auto',
})

const hrCss = css({
  border: 'none',
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  margin: '0.5rem 0',
})

function InlineView(handle: Handle<{ tokens: InlineToken[] }>) {
  return () => (
    <Fragment>
      {handle.props.tokens.map((token, index) => {
        switch (token.type) {
          case 'text':
            return <span key={index}>{token.text}</span>
          case 'bold':
            return (
              <strong key={index} mix={boldCss}>
                <InlineView tokens={token.children} />
              </strong>
            )
          case 'italic':
            return (
              <em key={index}>
                <InlineView tokens={token.children} />
              </em>
            )
          case 'code':
            return (
              <code key={index} mix={codeCss}>
                {token.text}
              </code>
            )
          case 'link':
            return (
              <a
                key={index}
                href={token.href}
                target="_blank"
                rel="noreferrer noopener"
                mix={linkCss}
              >
                {token.text}
              </a>
            )
          default:
            return null
        }
      })}
    </Fragment>
  )
}

function BlockView(handle: Handle<{ block: MarkdownBlock }>) {
  return () => {
    let block = handle.props.block
    switch (block.type) {
      case 'paragraph':
        return (
          <p mix={paragraphCss}>
            <InlineView tokens={block.inline} />
          </p>
        )
      case 'heading':
        return (
          <div mix={headingCss}>
            <InlineView tokens={block.inline} />
          </div>
        )
      case 'list': {
        let items = block.items.map((item, index) => (
          <li key={index}>
            <InlineView tokens={item} />
          </li>
        ))
        return block.ordered ? <ol mix={listCss}>{items}</ol> : <ul mix={listCss}>{items}</ul>
      }
      case 'code':
        return <pre mix={preCss}>{block.text}</pre>
      case 'hr':
        return <hr mix={hrCss} />
      default:
        return null
    }
  }
}

export function MarkdownText(handle: Handle<{ text: string }>) {
  return () => (
    <Fragment>
      {parseMarkdown(handle.props.text).map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </Fragment>
  )
}
