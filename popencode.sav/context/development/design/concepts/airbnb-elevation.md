# Concept: Airbnb Elevation & Depth

**Core Idea**: Three-layer shadow system creates natural, warm lift. Layer 1 is ultra-subtle border, Layer 2 provides soft ambient shadow, Layer 3 adds primary lift—mimicking natural light.

**Key Points**:
- Layer 1 (border): `0px 0px 0px 1px` at 2% opacity—ultra-subtle ring
- Layer 2 (ambient): `0px 2px 6px` at 4% opacity—soft blur
- Layer 3 (lift): `0px 4px 8px` at 10% opacity—primary elevation
- Hover: `rgba(0,0,0,0.08) 0px 4px 12px`—button/interactive lift
- Active/Focus: `0px 0px 0px 4px` white ring + focus shadow

**Elevation Levels**:
| Level | Treatment | Use |
|-------|-----------|-----|
| 0 (Flat) | No shadow | Page background, text |
| 1 (Card) | Full three-layer | Listing cards, search |
| 2 (Hover) | Single soft shadow | Button hover, lift |
| 3 (Active) | White ring + shadow | Active/focused |

**Quick Example**:
```css
/* Card elevation (Level 1) */
.card {
  box-shadow: 
    rgba(0,0,0,0.02) 0px 0px 0px 1px,
    rgba(0,0,0,0.04) 0px 2px 6px,
    rgba(0,0,0,0.1) 0px 4px 8px;
}

/* Interactive hover (Level 2) */
.card:hover {
  box-shadow: rgba(0,0,0,0.08) 0px 4px 12px;
}
```

**Reference**: Full spec at `/home/lucky/skills/DESIGN.md`

**Related**:
- examples/airbnb-components.md
