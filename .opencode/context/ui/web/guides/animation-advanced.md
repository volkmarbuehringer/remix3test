<!-- Context: ui/web/animation-advanced | Priority: medium | Version: 1.1 | Updated: 2026-05-13 -->

# Advanced Animation Patterns

Recipes, best practices, micro-interactions, and accessibility for web UI animations.

## Core Concept

Micro-interactions enhance UX through purposeful, performant animations. Use CSS `transform` + `opacity` for 60fps. Keep under 400ms for interactions, max 800ms for any animation. Use ease-out for entrances, ease-in for exits.

## Micro-Syntax Reference

Format: `name: duration easing [props]` — compact notation for animation specs.

### Page Transitions

```css
.page-exit  { animation: fadeOut 200ms ease-in; }
.page-enter { animation: fadeIn 300ms ease-out; }
@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
```
Micro-syntax: `pageExit: 200ms ease-in [α1→0]` / `pageEnter: 300ms ease-out [α0→1]`

### Micro-Interactions

```css
/* Link underline slide */
.link::after { content: ''; position: absolute; bottom: 0; left: 0; width: 0; height: 2px; background: currentColor; transition: width 250ms ease-out; }
.link:hover::after { width: 100%; }

/* Toggle switch */
.toggle-switch { transition: background-color 200ms ease-out; }
.toggle-switch .thumb { transition: transform 200ms ease-out; }
.toggle-switch.on .thumb { transform: translateX(20px); }
```

### Animation Recipe: Chat UI

```
userMsg:   400ms ease-out [Y+20→0, X+10→0, S0.9→1]
aiMsg:     600ms bounce [Y+15→0, S0.95→1] +200ms
typing:    1400ms ∞ [Y±8, α0.4→1] stagger+200ms
sidebar:   350ms ease-out [X-280→0, α0→1]
sendBtn:   150ms [S1→0.95→1] press / 200ms [S1→1.05] hover
chatLoad:  500ms ease-out [Y+40→0, α0→1]
skeleton:  2000ms ∞ [bg: muted↔accent]
spinner:   1000ms ∞ linear [R360°]
error:     400ms [X±5] shake
success:   600ms bounce [S0→1.2→1]
```

## Best Practices

### Do's ✅
- Keep interactions under 400ms, max 800ms for any animation
- Animate only `transform` and `opacity` for 60fps
- Use ease-out for entrances, ease-in for exits
- Stagger list animations 50-100ms
- Respect `prefers-reduced-motion`
- Test on low-end devices

### Don'ts ❌
- Avoid animating width/height (use scale)
- Don't exceed 800ms duration
- Don't ignore accessibility preferences
- Don't animate without purpose

## Accessibility

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  transition: outline-offset 150ms ease-out;
}
```

## References

- [Web Animation API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)
- [CSS Easing Functions](https://easings.net/)
- [Animation Performance](https://web.dev/animations-guide/)
- [Reduced Motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)

## Related Files

- [Animation Basics](./animation-basics.md) — Fundamentals, timing, easing
- [Animation Components](./animation-components.md) — Common UI component patterns
- [Loading Animations](./animation-loading.md) — Skeleton, spinner, progress states
