import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { parseInline, parseMarkdown } from './markdown.ts'

describe('parseInline', () => {
  it('keeps plain text as a single text token', () => {
    assert.deepEqual(parseInline('Hallo Welt'), [{ type: 'text', text: 'Hallo Welt' }])
  })

  it('parses bold, italic and inline code', () => {
    let tokens = parseInline('**fett** und *kursiv* und `code`')
    assert.equal(tokens.length, 5)
    assert.deepEqual(tokens[0], { type: 'bold', children: [{ type: 'text', text: 'fett' }] })
    assert.deepEqual(tokens[2], { type: 'italic', children: [{ type: 'text', text: 'kursiv' }] })
    assert.deepEqual(tokens[4], { type: 'code', text: 'code' })
  })

  it('parses explicit markdown links', () => {
    assert.deepEqual(parseInline('[Doku](https://example.com/x)'), [
      { type: 'link', text: 'Doku', href: 'https://example.com/x' },
    ])
  })

  it('autolinks bare https URLs and trims trailing punctuation', () => {
    assert.deepEqual(parseInline('siehe https://example.com/a.'), [
      { type: 'text', text: 'siehe ' },
      { type: 'link', text: 'https://example.com/a', href: 'https://example.com/a' },
      { type: 'text', text: '.' },
    ])
  })

  it('does not create links for unsafe schemes', () => {
    assert.deepEqual(parseInline('javascript:alert(1)'), [
      { type: 'text', text: 'javascript:alert(1)' },
    ])
  })
})

describe('parseMarkdown', () => {
  it('parses paragraphs', () => {
    assert.deepEqual(parseMarkdown('Ein Absatz.'), [
      { type: 'paragraph', inline: [{ type: 'text', text: 'Ein Absatz.' }] },
    ])
  })

  it('parses headings', () => {
    assert.deepEqual(parseMarkdown('## Überschrift'), [
      { type: 'heading', level: 2, inline: [{ type: 'text', text: 'Überschrift' }] },
    ])
  })

  it('parses bullet and ordered lists', () => {
    let blocks = parseMarkdown('- eins\n- zwei\n\n1. a\n2. b')
    assert.equal(blocks.length, 2)
    assert.deepEqual(blocks[0], {
      type: 'list',
      ordered: false,
      items: [[{ type: 'text', text: 'eins' }], [{ type: 'text', text: 'zwei' }]],
    })
    assert.deepEqual(blocks[1], {
      type: 'list',
      ordered: true,
      items: [[{ type: 'text', text: 'a' }], [{ type: 'text', text: 'b' }]],
    })
  })

  it('parses fenced code blocks', () => {
    assert.deepEqual(parseMarkdown('```\nlet x = 1\n```'), [{ type: 'code', text: 'let x = 1' }])
  })

  it('parses horizontal rules', () => {
    assert.deepEqual(parseMarkdown('---'), [{ type: 'hr' }])
  })

  it('keeps inline formatting inside paragraphs', () => {
    let blocks = parseMarkdown('Der **Status** ist *ok*.')
    assert.equal(blocks.length, 1)
    let paragraph = blocks[0]!
    assert.equal(paragraph.type, 'paragraph')
    if (paragraph.type === 'paragraph') {
      assert.deepEqual(paragraph.inline[1], {
        type: 'bold',
        children: [{ type: 'text', text: 'Status' }],
      })
    }
  })

  it('treats an empty string as no blocks', () => {
    assert.deepEqual(parseMarkdown(''), [])
  })
})
