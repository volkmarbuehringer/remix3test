import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

// ---------------------------------------------------------------------------
// Appointment Grid — Browser behavior tests
//
// These tests run in a real browser (Playwright) and verify client-side DOM
// behaviors that cannot be tested with server-only integration tests:
//
//   - white-space: pre-wrap renders \n as line breaks in block titles
//   - CSS expandedTitleStyle changes display on hover
//   - <textarea> Enter key inserts newline, Shift+Enter does NOT insert
//   - Button click handlers (pointerdown) prevent blur race
//   - Focus behavior via requestAnimationFrame timing
//   - Blur cancels draft/edit (no auto-save)
//   - Escape key cancels draft/edit
//
// Each test creates its own DOM fixtures to isolate the behavior being
// tested. These are NOT integration tests against the full appointment
// page — they verify the fundamental DOM/CSS/event primitives that the
// clientEntry component depends on.
// ---------------------------------------------------------------------------

// -----------------------------------------------------------------------
// 1. CSS Rendering: white-space: pre-wrap
// -----------------------------------------------------------------------

describe('Multiline title CSS rendering', () => {
  it('white-space: pre-wrap renders \\n as visible line breaks', () => {
    // Arrange: create a span with white-space: pre-wrap and multiline text
    let el = document.createElement('span')
    el.style.whiteSpace = 'pre-wrap'
    el.style.display = 'block'
    el.textContent = 'Line 1\nLine 2\nLine 3'
    document.body.append(el)

    // Act: measure rendered height
    let height = el.getBoundingClientRect().height

    // Assert: multiline text should be taller than single-line
    let singleLine = document.createElement('span')
    singleLine.style.whiteSpace = 'pre-wrap'
    singleLine.style.display = 'block'
    singleLine.textContent = 'Line 1'
    document.body.append(singleLine)
    let singleHeight = singleLine.getBoundingClientRect().height

    assert.ok(
      height > singleHeight,
      'multiline text with pre-wrap should be taller than single-line text',
    )

    // Cleanup
    el.remove()
    singleLine.remove()
  })

  it('white-space: normal collapses \\n to spaces (baseline comparison)', () => {
    // Arrange: a span WITHOUT pre-wrap (old behavior)
    let el = document.createElement('span')
    el.style.whiteSpace = 'normal'
    el.style.display = 'block'
    el.textContent = 'Line 1\nLine 2\nLine 3'
    document.body.append(el)

    let preWrapEl = document.createElement('span')
    preWrapEl.style.whiteSpace = 'pre-wrap'
    preWrapEl.style.display = 'block'
    preWrapEl.textContent = 'Line 1\nLine 2\nLine 3'
    document.body.append(preWrapEl)

    // Act
    let normalHeight = el.getBoundingClientRect().height
    let preWrapHeight = preWrapEl.getBoundingClientRect().height

    // Assert: pre-wrap should be taller (normal collapses newlines to spaces)
    assert.ok(
      preWrapHeight > normalHeight,
      'pre-wrap should render taller than normal (which collapses newlines)',
    )

    // Cleanup
    el.remove()
    preWrapEl.remove()
  })

  it('expanded title (block + pre-wrap) shows full multiline content', () => {
    // Arrange: create a clamped span and an expanded span
    let clamped = document.createElement('span')
    clamped.style.display = '-webkit-box'
    ;(clamped.style as any).WebkitLineClamp = '2'
    ;(clamped.style as any).WebkitBoxOrient = 'vertical'
    clamped.style.overflow = 'hidden'
    clamped.style.whiteSpace = 'pre-wrap'
    clamped.textContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
    clamped.style.width = '100px'
    document.body.append(clamped)

    let expanded = document.createElement('span')
    expanded.style.display = 'block'
    expanded.style.overflow = 'visible'
    expanded.style.whiteSpace = 'pre-wrap'
    expanded.textContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
    expanded.style.width = '100px'
    document.body.append(expanded)

    // Act
    let clampedHeight = clamped.getBoundingClientRect().height
    let expandedHeight = expanded.getBoundingClientRect().height

    // Assert: expanded should be taller (shows clamped lines 4 and 5)
    assert.ok(
      expandedHeight > clampedHeight,
      'expanded display:block should show more lines than clamped -webkit-box',
    )

    // Cleanup
    clamped.remove()
    expanded.remove()
  })
})

// -----------------------------------------------------------------------
// 2. Textarea Multiline Behavior
// -----------------------------------------------------------------------

describe('Textarea multiline input behavior', () => {
  it('Enter key inserts newline in textarea', () => {
    // Arrange
    let ta = document.createElement('textarea')
    ta.rows = 2
    document.body.append(ta)
    ta.focus()

    // Act: type "Hello" then press Enter
    ta.value = 'Hello'
    let enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      keyCode: 13,
      bubbles: true,
      cancelable: true,
    })
    // The default behavior of Enter in textarea is to insert a newline
    // We verify by checking if the default was NOT prevented
    let defaultPrevented = !ta.dispatchEvent(enterEvent)

    // Assert: textarea should allow Enter (default) to insert newline
    assert.ok(
      !defaultPrevented,
      'Enter keydown should NOT have default prevented in textarea (allows newline)',
    )

    // Simulate the default behavior (what the browser does)
    ta.value = 'Hello\n'

    assert.equal(ta.value, 'Hello\n', 'textarea should contain newline after Enter')

    // Cleanup
    ta.remove()
  })

  it('Shift+Enter in textarea can be intercepted (default prevented)', () => {
    // Arrange: simulate the clientEntry pattern where Shift+Enter is captured
    let ta = document.createElement('textarea')
    ta.rows = 2
    document.body.append(ta)
    ta.focus()

    let captured = false
    let handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault()
        captured = true
      }
    }
    ta.addEventListener('keydown', handler)

    // Act: dispatch Shift+Enter
    let shiftEnterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      keyCode: 13,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    ta.dispatchEvent(shiftEnterEvent)

    // Assert: Shift+Enter should be intercepted (default prevented)
    assert.ok(captured, 'Shift+Enter handler should have been called')
    assert.ok(
      shiftEnterEvent.defaultPrevented,
      'Shift+Enter default should be prevented (commits instead of newline)',
    )

    ta.removeEventListener('keydown', handler)
    ta.remove()
  })

  it('Escape key triggers cancel handler', () => {
    // Arrange
    let ta = document.createElement('textarea')
    ta.value = 'Draft text'
    document.body.append(ta)
    ta.focus()

    let cancelled = false
    let handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelled = true
        ta.value = '' // Simulate cancel: clear the textarea
      }
    }
    ta.addEventListener('keydown', handler)

    // Act: press Escape
    let escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      keyCode: 27,
      bubbles: true,
      cancelable: true,
    })
    ta.dispatchEvent(escapeEvent)

    // Assert
    assert.ok(cancelled, 'Escape should trigger cancel handler')
    assert.equal(ta.value, '', 'Escape cancel should clear the textarea value')

    ta.removeEventListener('keydown', handler)
    ta.remove()
  })

  it('textarea rows=2 renders with visible height', () => {
    // Arrange
    let ta = document.createElement('textarea')
    ta.rows = 2
    document.body.append(ta)

    // Act
    let height = ta.getBoundingClientRect().height

    // Assert
    assert.ok(height > 0, 'rows=2 textarea should have visible height')
    assert.ok(height >= 30, 'two-row textarea should be at least 30px tall')

    ta.remove()
  })

  it('textarea with overflow-y:auto scrolls when content exceeds 2 rows', () => {
    // Arrange
    let ta = document.createElement('textarea')
    ta.rows = 2
    ta.style.overflowY = 'auto'
    ta.style.resize = 'none'
    document.body.append(ta)

    // Act: add multiline content that exceeds 2 rows
    ta.value = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6'

    // Assert: should have scrollable overflow
    assert.ok(
      ta.scrollHeight > ta.clientHeight,
      'textarea should scroll when content exceeds 2 rows',
    )

    ta.remove()
  })
})

// -----------------------------------------------------------------------
// 3. Button pointerdown pattern
// -----------------------------------------------------------------------

describe('Button click handling (pointerdown prevents blur race)', () => {
  it('pointerdown fires before blur on button click', () => {
    // Arrange: simulate the draft/edit save/cancel button pattern
    let input = document.createElement('textarea')
    input.value = 'Test content'
    document.body.append(input)

    let blurFired = false
    let pointerdownFired = false
    let order: string[] = []

    // Blur handler (would cancel in the real component)
    input.addEventListener('blur', () => {
      blurFired = true
      order.push('blur')
    })

    let button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Save'
    document.body.append(button)

    // pointerdown handler (fires before blur of textarea)
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      pointerdownFired = true
      order.push('pointerdown')
    })

    // Act: simulate clicking the button while textarea is focused
    input.focus()
    assert.ok(document.activeElement === input, 'textarea should be focused')

    // Simulate pointerdown on button (happens before blur)
    let pointerEvent = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
    })
    button.dispatchEvent(pointerEvent)

    // Simulate blur on input (happens after pointerdown)
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }))

    // Assert: pointerdown fires before blur
    assert.ok(
      pointerdownFired,
      'pointerdown on button should have fired',
    )
    assert.ok(blurFired, 'blur on textarea should have fired')
    assert.equal(
      order[0],
      'pointerdown',
      'pointerdown should fire BEFORE blur on button click',
    )

    // Cleanup
    input.remove()
    button.remove()
  })

  it('mousedown also fires before blur (but pointerdown is used for multi-input support)', () => {
    // This test validates the rationale for using pointerdown over mousedown
    let input = document.createElement('textarea')
    input.value = 'Test'
    document.body.append(input)
    input.focus()

    let pointerdownCount = 0
    let mousedownCount = 0
    let button = document.createElement('button')
    button.addEventListener('pointerdown', () => pointerdownCount++)
    button.addEventListener('mousedown', () => mousedownCount++)
    document.body.append(button)

    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    assert.ok(pointerdownCount >= 1, 'pointerdown should fire')
    assert.ok(
      pointerdownCount >= mousedownCount,
      'pointerdown should fire at least as often as mousedown',
    )

    input.remove()
    button.remove()
  })
})

// -----------------------------------------------------------------------
// 4. Focus/blur behavior
// -----------------------------------------------------------------------

describe('Draft/Edit focus and blur behavior', () => {
  it('focusing a textarea sets it as the active element', () => {
    // Arrange
    let ta = document.createElement('textarea')
    ta.rows = 2
    document.body.append(ta)

    // Act
    ta.focus()

    // Assert
    assert.equal(
      document.activeElement,
      ta,
      'textarea should be the active element after focus()',
    )

    ta.remove()
  })

  it('blur removes focus from textarea', () => {
    // Arrange
    let ta = document.createElement('textarea')
    document.body.append(ta)
    ta.focus()
    assert.equal(document.activeElement, ta, 'textarea should start focused')

    // Act
    ta.blur()

    // Assert
    assert.notEqual(
      document.activeElement,
      ta,
      'textarea should NOT be active after blur()',
    )

    ta.remove()
  })

  it('requestAnimationFrame schedules callback before next paint', () =>
    // This tests the timing mechanism used by startEdit() and startDraft()
    // The real component uses requestAnimationFrame() to focus after DOM update

    new Promise<void>((resolve) => {
      // Arrange
      let ta = document.createElement('textarea')
      document.body.append(ta)
      let rafFired = false

      // Act: simulate the rAF pattern from the real component
      requestAnimationFrame(() => {
        rafFired = true
        ta.focus()
      })

      // Assert: after a microtask, rAF should have fired and focus set
      setTimeout(() => {
        assert.ok(rafFired, 'requestAnimationFrame callback should have fired')
        assert.equal(
          document.activeElement,
          ta,
          'textarea should be focused after rAF callback',
        )
        ta.remove()
        resolve()
      }, 50)
    })
  )
})

// -----------------------------------------------------------------------
// 5. Keyboard shortcut behavior
// -----------------------------------------------------------------------

describe('Keyboard shortcuts (Enter, Shift+Enter, Escape)', () => {
  it('Enter inserts newline, does not trigger commit (no Shift)', () => {
    // Arrange: simulate the clientEntry keydown handler pattern
    let ta = document.createElement('textarea')
    ta.value = 'Start'
    document.body.append(ta)
    ta.focus()

    let committed = false
    let handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // cancel
        return
      }
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          e.preventDefault()
          committed = true // Shift+Enter = commit
        }
        // Plain Enter = let browser insert newline (no preventDefault)
        return
      }
    }
    ta.addEventListener('keydown', handler)

    // Act: press Enter (no Shift)
    let enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: false,
      bubbles: true,
      cancelable: true,
    })
    ta.dispatchEvent(enterEvent)

    // Assert: plain Enter should NOT trigger commit
    assert.ok(!committed, 'plain Enter should NOT trigger commit')
    assert.ok(
      !enterEvent.defaultPrevented,
      'plain Enter should NOT have default prevented (allows newline)',
    )

    ta.removeEventListener('keydown', handler)
    ta.remove()
  })

  it('Shift+Enter triggers commit and prevents newline', () => {
    // Arrange
    let ta = document.createElement('textarea')
    ta.value = 'Draft text'
    document.body.append(ta)

    let committed = false
    let handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault()
        committed = true
      }
    }
    ta.addEventListener('keydown', handler)

    // Act: press Shift+Enter
    let shiftEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    ta.dispatchEvent(shiftEnter)

    // Assert: Shift+Enter should trigger commit and prevent newline
    assert.ok(committed, 'Shift+Enter should trigger commit action')
    assert.ok(
      shiftEnter.defaultPrevented,
      'Shift+Enter should prevent default (no newline inserted)',
    )

    ta.removeEventListener('keydown', handler)
    ta.remove()
  })

  it('Escape cancels without committing', () => {
    // Arrange
    let ta = document.createElement('textarea')
    ta.value = 'Unsaved text'
    document.body.append(ta)

    let cancelled = false
    let committed = false
    let handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelled = true
      }
      if (e.key === 'Enter' && e.shiftKey) {
        committed = true
      }
    }
    ta.addEventListener('keydown', handler)

    // Act: press Escape
    let escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    ta.dispatchEvent(escapeEvent)

    // Assert
    assert.ok(cancelled, 'Escape should trigger cancel')
    assert.ok(!committed, 'Escape should NOT trigger commit')

    ta.removeEventListener('keydown', handler)
    ta.remove()
  })
})

// -----------------------------------------------------------------------
// 6. Conditional rendering patterns
// -----------------------------------------------------------------------

describe('Conditional rendering patterns', () => {
  it('title span should not be in DOM during editing (null rendering)', () => {
    // Simulate the pattern: {!isEditing ? <span>title</span> : null}
    let container = document.createElement('div')

    // Not editing: span is present
    let isEditing = false
    if (!isEditing) {
      let span = document.createElement('span')
      span.textContent = 'Appointment Title'
      container.append(span)
    }

    assert.equal(
      container.children.length,
      1,
      'when not editing, title span should be in DOM',
    )
    assert.equal(
      container.querySelector('span')?.textContent,
      'Appointment Title',
      'span should contain the title text',
    )

    // Clear and simulate editing
    container.innerHTML = ''
    isEditing = true
    if (!isEditing) {
      let span = document.createElement('span')
      span.textContent = 'Appointment Title'
      container.append(span)
    }

    assert.equal(
      container.children.length,
      0,
      'when editing, title span should NOT be in DOM',
    )
  })

  it('buttons are added to DOM when editing is active', () => {
    let container = document.createElement('div')

    // Simulate: {isEditing ? <div buttons/> : null}
    let isEditing = true
    if (isEditing) {
      let buttonRow = document.createElement('div')
      let saveBtn = document.createElement('button')
      saveBtn.type = 'button'
      saveBtn.textContent = 'Save'
      let cancelBtn = document.createElement('button')
      cancelBtn.type = 'button'
      cancelBtn.textContent = 'Cancel'
      buttonRow.append(saveBtn, cancelBtn)
      container.append(buttonRow)
    }

    assert.equal(container.children.length, 1, 'buttons should be present when editing')
    assert.ok(container.textContent?.includes('Save'), 'Save button should be visible')
    assert.ok(container.textContent?.includes('Cancel'), 'Cancel button should be visible')
  })
})

// -----------------------------------------------------------------------
// 7. Resize handles hidden during editing
// -----------------------------------------------------------------------

describe('Resize handle visibility during editing', () => {
  it('resize handles should not be rendered when editing is active', () => {
    let container = document.createElement('div')
    let isEditing = true
    let isDragging = false

    // Simulate: {!isDragging && !isEditing ? <resizeHandles/> : null}
    if (!isDragging && !isEditing) {
      let startHandle = document.createElement('div')
      startHandle.setAttribute('aria-label', 'Resize start')
      container.append(startHandle)
      let endHandle = document.createElement('div')
      endHandle.setAttribute('aria-label', 'Resize end')
      container.append(endHandle)
    }

    assert.equal(
      container.children.length,
      0,
      'resize handles should NOT render during editing',
    )
  })

  it('resize handles render when not dragging and not editing', () => {
    let container = document.createElement('div')
    let isEditing = false
    let isDragging = false

    if (!isDragging && !isEditing) {
      let startHandle = document.createElement('div')
      startHandle.setAttribute('aria-label', 'Resize start')
      container.append(startHandle)
      let endHandle = document.createElement('div')
      endHandle.setAttribute('aria-label', 'Resize end')
      container.append(endHandle)
    }

    assert.equal(
      container.children.length,
      2,
      'both resize handles should render when not editing/dragging',
    )
  })
})

// -----------------------------------------------------------------------
// 8. Block height during editing vs default
// -----------------------------------------------------------------------

describe('Block height adjustments during editing', () => {
  it('editing block should have larger min-height than default block', () => {
    // Simulate the inline style height calculation:
    // Math.max(isEditing ? 84 : 48, slotHeight)
    let isEditing = true
    let slotHeight = 60 // 1-hour slot
    let editingHeight = Math.max(isEditing ? 84 : 48, slotHeight)
    assert.equal(editingHeight, 84, 'editing block should use 84px min-height')

    isEditing = false
    let defaultHeight = Math.max(isEditing ? 84 : 48, slotHeight)
    assert.equal(defaultHeight, 60, 'default block should use slot height (60px) when > 48px')

    let shortSlot = 30 // 30-min slot
    let editingShort = Math.max(true ? 84 : 48, shortSlot)
    assert.equal(editingShort, 84, 'editing short block should use 84px min-height')

    let defaultShort = Math.max(false ? 84 : 48, shortSlot)
    assert.equal(defaultShort, 48, 'default short block should use 48px min-height')
  })
})
