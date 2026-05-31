# Guide: Airbnb Layout Principles

**Core Idea**: Travel-magazine spacing creates leisurely browsing pace—generous padding between sections contrasts with tightly-packed listing grids. Search bar gets maximum prominence.

**Key Points**:
- Base unit: 8px
- Spacing scale: 2, 3, 4, 6, 8, 10, 11, 12, 15, 16, 22, 24, 32px
- Full-width header with centered search bar (hero element)
- Category pill bar: horizontal scrollable row below search
- Listing grid: responsive 3-5 columns on desktop
- Full-width footer with link columns

**Grid Breakpoints**:
| Viewport | Columns |
|----------|---------|
| Desktop Large (1440+) | 5 |
| Desktop (1128-1440) | 4 |
| Desktop Small (950-1128) | 3 |
| Tablet (744-950) | Search expansion |
| Mobile (375-744) | 2-1 |

**Quick Example**:
```css
/* Header - search bar prominence */
.header {
  position: sticky;
  top: 0;
  background: #ffffff;
  padding: 16px 24px;
}

.search-container {
  max-width: 800px;
  margin: 0 auto;
  box-shadow: /* three-layer card shadow */;
  border-radius: 32px;
}

/* Category pill bar */
.category-pills {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 12px 24px;
}
```

**Reference**: Full layout spec at `/home/lucky/skills/DESIGN.md`

**Related**:
- guides/airbnb-responsive.md
- concepts/airbnb-visual-theme.md
