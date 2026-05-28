# Guide: Airbnb Agent Prompt Quick Reference

**Core Idea**: Pre-built prompt patterns for generating Airbnb-styled components—copy/paste templates for common UI patterns.

**Key Points**:
- Always specify white background, warm near-black text (#222222)
- Rausch Red (#ff385c) for CTAs only
- Three-layer shadow required for cards
- Generous border-radius: 8px buttons, 20px cards, 50% controls

**Quick Reference Prompts**:

```text
"Listing card: white bg, 20px radius. Three-layer shadow. 
Photo area top (16:10 ratio), details below: 16px Cereal VF 
weight 600 title, 14px weight 400 desc in #6a6a6a."

"Search bar: white bg, full card shadow, 32px radius.
Search text 14px Cereal VF weight 400. Red search 
button (#ff385c, 50% radius, white icon)."

"Category pill bar: horizontal scrollable row. Each pill:
14px Cereal VF weight 600, #222222 text, bottom border active.
Circular prev/next arrows (#f2f2f2 bg, 50% radius)."

"CTA button: #222222 bg, white text, 8px radius, 16px 
Cereal VF weight 500, 0 24px padding. Hover: #ff385c."

"Heart/wishlist: transparent bg, 50% radius, white heart 
icon with dark shadow outline."
```

**Design Iteration Guide**:
1. Start with white—photography provides all color
2. Rausch Red (#ff385c) is singular accent—use for CTAs only
3. Near-black (#222222) for text—warmth matters
4. Three-layer shadows create natural lift—always use all layers
5. Generous radius: 8px buttons, 20px cards, 50% controls
6. Photography is hero—every listing card image-first
7. Cereal VF at 500–700 weight—no thin weights for headings

**Reference**: Full spec at `/home/lucky/skills/DESIGN.md`

**Related**:
- lookup/airbnb-colors.md
- lookup/airbnb-dos-donts.md
