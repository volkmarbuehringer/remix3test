import { definePlugin, defineRule } from '@oxlint/plugins'
import type { Context, ESTree } from '@oxlint/plugins'

// HTML content model: an element that is itself interactive must not contain
// another interactive element. The classic violation is a <button> nested in an
// <a> (often to style a link as a button), which is invalid HTML: browsers keep
// the inner control's activation behavior, so a submit button swallows the
// link, and assistive tech loses the link role. Style the <a> directly with
// `buttonLink()` from app/ui/theme/button.ts instead.
//
// The upstream jsx_a11y rules do not cover the content model (anchor-is-valid
// and anchor-has-content only inspect an anchor's own href/label), so this is a
// repo-local rule. `html-validate`'s element-permitted-content can catch it on
// rendered HTML, but not on JSX source.
const INTERACTIVE_ELEMENTS = new Set([
  'a',
  'button',
  'details',
  'embed',
  'iframe',
  'input',
  'label',
  'object',
  'select',
  'textarea',
])

const HOST_ELEMENTS = new Set(['a', 'button'])

function tagName(node: ESTree.JSXElement): string | null {
  let name = node.openingElement.name
  if (name.type === 'JSXIdentifier') {
    // Lowercase names are intrinsic DOM elements; PascalCase ones are components.
    return name.name === name.name.toLowerCase() ? name.name : null
  }
  return null
}

/** `input[type="hidden"]` is not in the interactive-content category. */
function isHiddenInput(node: ESTree.JSXElement): boolean {
  if (tagName(node) !== 'input') {
    return false
  }
  return node.openingElement.attributes.some((attribute) => {
    if (
      attribute.type !== 'JSXAttribute' ||
      attribute.name.type !== 'JSXIdentifier' ||
      attribute.name.name !== 'type'
    ) {
      return false
    }
    let value = attribute.value
    return value != null && 'value' in value && value.value === 'hidden'
  })
}

/** Walks ancestors for the nearest enclosing interactive host JSX element. */
function findHostElement(node: ESTree.JSXElement): ESTree.JSXElement | null {
  let current: ESTree.Node | null = node.parent
  while (current != null) {
    if (current.type === 'JSXElement') {
      let tag = tagName(current)
      if (tag != null && HOST_ELEMENTS.has(tag)) {
        return current
      }
    }
    current = current.parent
  }
  return null
}

const noNestedInteractiveRule = defineRule({
  meta: {
    type: 'problem',
  },
  create(context: Context) {
    return {
      JSXElement(node: ESTree.JSXElement) {
        let tag = tagName(node)
        if (tag == null || !INTERACTIVE_ELEMENTS.has(tag) || isHiddenInput(node)) {
          return
        }

        let host = findHostElement(node)
        if (host == null) {
          return
        }

        let hostTag = tagName(host)
        context.report({
          node,
          message: `<${tag}> is interactive content and must not be nested inside <${hostTag}>. For an action link, style the <a> with buttonLink() instead of nesting a <button>.`,
        })
      },
    }
  },
})

/**
 * Rejects invalid HTML where an interactive element contains another
 * interactive element (notably <a><button>). Motivated by a real regression
 * where a nested submit button inside the appointments filter form submitted
 * the form instead of following the link, silently dropping the filter.
 */
export default definePlugin({
  meta: {
    name: 'remix-a11y',
  },
  rules: {
    'no-nested-interactive': noNestedInteractiveRule,
  },
})
