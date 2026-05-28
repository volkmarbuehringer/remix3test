# Concept: Airbnb Visual Theme

**Core Idea**: Warm, photography-forward marketplace design using pure white canvas with Rausch Red (#ff385c) as singular brand accent. Photography is the hero—listing images provide all color.

**Key Points**:
- Pure white (#ffffff) background creates airy, travel-magazine feel
- Rausch Red (#ff385c) named after Airbnb's first street address—used sparingly for CTAs
- Near-black (#222222) text is warm, never pure black
- Luxe Purple (#460479) and Plus Magenta (#92174d) for premium tiers
- Palette-based token system (`--palette-*`) for systematic color management
- Three-layer card shadow creates subtle, warm lift

**Quick Example**:
```css
/* Core tokens */
--palette-bg-primary-core: #ff385c;  /* Rausch Red */
--palette-text-primary: #222222;     /* Warm near-black */
--palette-bg-surface: #ffffff;       /* Pure white */

/* Three-layer card shadow */
--shadow-card: 
  rgba(0,0,0,0.02) 0px 0px 0px 1px,
  rgba(0,0,0,0.04) 0px 2px 6px,
  rgba(0,0,0,0.1) 0px 4px 8px;
```

**Reference**: https://airbnb.design/the-airbnb-brand/

**Related**:
- lookup/airbnb-colors.md
- guides/airbnb-prompts.md
