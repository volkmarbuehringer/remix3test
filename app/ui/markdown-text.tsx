import { Fragment, type Handle } from 'remix/ui'
import { theme } from './theme/theme.ts'
import { parseMarkdown, type InlineToken, type MarkdownBlock } from '../utils/markdown.ts'

function InlineView(handle: Handle<{ tokens: InlineToken[] }>) {
  return () => (
    <Fragment>
      {handle.props.tokens.map((token, index) => {
        switch (token.type) {
          case 'text':
            return <span key={index}>{token.text}</span>
          case 'bold':
            return (
              <strong key={index} style={{ fontWeight: 700 }}>
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
              <code
                key={index}
                style={{
                  fontFamily: theme.fontFamily.mono,
                  fontSize: '0.8em',
                  background: theme.surface.lvl2,
                  padding: '0 0.25rem',
                  borderRadius: '4px',
                }}
              >
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
                style={{ color: theme.colors.text.link, textDecoration: 'underline' }}
              >
                {token.text}
              </a>
            )
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
          <p style={{ margin: '0 0 0.5rem' }}>
            <InlineView tokens={block.inline} />
          </p>
        )
      case 'heading':
        return (
          <div style={{ fontWeight: 600, margin: '0.25rem 0 0.5rem' }}>
            <InlineView tokens={block.inline} />
          </div>
        )
      case 'list': {
        let items = block.items.map((item, index) => (
          <li key={index}>
            <InlineView tokens={item} />
          </li>
        ))
        return block.ordered ? (
          <ol style={{ margin: '0 0 0.5rem', paddingLeft: '1.25rem' }}>{items}</ol>
        ) : (
          <ul style={{ margin: '0 0 0.5rem', paddingLeft: '1.25rem' }}>{items}</ul>
        )
      }
      case 'code':
        return (
          <pre
            style={{
              margin: '0 0 0.5rem',
              padding: '0.5rem',
              background: theme.surface.lvl2,
              borderRadius: '6px',
              fontFamily: theme.fontFamily.mono,
              fontSize: '0.75rem',
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
            }}
          >
            {block.text}
          </pre>
        )
      case 'hr':
        return (
          <hr
            style={{
              border: 'none',
              borderTop: `1px solid ${theme.colors.border.subtle}`,
              margin: '0.5rem 0',
            }}
          />
        )
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
