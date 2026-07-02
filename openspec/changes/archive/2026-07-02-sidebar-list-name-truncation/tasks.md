## 1. Sidebar List Name Truncation

- [x] 1.1 Import `tooltipAnchorStyle` from `app/ui/layout.tsx` into `app/ui/lists-layout.tsx`
- [x] 1.2 Add a `truncateStyle` mixin with `overflow: 'hidden'`, `textOverflow: 'ellipsis'`, `whiteSpace: 'nowrap'` in `app/ui/lists-layout.tsx`
- [x] 1.3 Apply `truncateStyle` and `tooltipAnchorStyle` mixins to the list name `<span>` element, and add `data-tooltip` attribute with the `displayName` value
- [x] 1.4 Run `npm run typecheck` to verify no type errors
- [x] 1.5 Run `npm test` to verify no regressions
