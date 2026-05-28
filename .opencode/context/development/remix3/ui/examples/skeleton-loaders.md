<!-- Context: development/remix3/examples/skeleton-loaders | Priority: low | Version: 1.0 | Updated: 2026-03-22 -->

# Skeleton Loaders

Loading skeleton patterns to prevent layout shift during data fetch.

## Skeleton Animation

```css
@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.skeleton {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}
```

## Skeleton Variants

```css
.skeleton-text {
  height: 1rem;
  width: 100%;
}
.skeleton-text-short {
  width: 60px;
}
.skeleton-badge {
  width: 70px;
  height: 1.5rem;
  border-radius: 9999px;
}
```

## Table Skeleton

```css
.skeleton-table-row {
  display: flex;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--color-slate-100);
  gap: 1rem;
}

.skeleton-table-cell {
  flex: 1;
}
.skeleton-table-cell-sm {
  flex: 0 0 60px;
}
```

## Usage

```html
<!-- Table loading state -->
<div class="table-loading-overlay">
  <div class="skeleton-table-row">
    <div class="skeleton skeleton-table-cell-sm"></div>
    <div class="skeleton skeleton-table-cell"></div>
    <div class="skeleton skeleton-badge"></div>
  </div>
</div>
```

## Key Points

- Shimmer animation creates loading perception
- Match skeleton size to real content
