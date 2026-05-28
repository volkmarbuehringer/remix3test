# Guide: Airbnb Responsive Design

**Core Idea**: Granular breakpoint system (61 breakpoints) with consistent collapsing strategy—listing grid scales from 5→4→3→2→1 columns while maintaining image-first cards.

**Key Points**:
- 61 detected breakpoints—one of most granular systems observed
- Core breakpoints: Mobile Small (<375), Mobile (375-550), Tablet Small (550-744), Tablet (744-950), Desktop Small (950-1128), Desktop (1128-1440), Large Desktop (1440-1920), Ultra-wide (>1920)
- Grid collapse: 5→4→3→2→1 columns
- Search collapse: expanded → compact → overlay
- Category pills: horizontal scroll at all sizes
- Touch targets: full-card tap on mobile, adequate circular nav sizing

**Quick Example**:
```css
/* Grid collapse pattern */
.listing-grid {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(5, 1fr);
}

@media (max-width: 1440px) {
  .listing-grid { grid-template-columns: repeat(4, 1fr); }
}
@media (max-width: 1128px) {
  .listing-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 744px) {
  .listing-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 375px) {
  .listing-grid { grid-template-columns: 1fr; }
}

/* Category pills - always horizontal scroll */
.category-pills {
  display: flex;
  overflow-x: auto;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}
```

**Reference**: Full responsive spec at `/home/lucky/skills/DESIGN.md`

**Related**:
- guides/airbnb-layout.md
- lookup/airbnb-dos-donts.md
