# Examples: Airbnb Components

**Core Idea**: Reusable component patterns with consistent styling—buttons, cards, inputs, and navigation following Airbnb's design system.

**Key Points**:
- Primary Dark button: #222222 bg, 8px radius, white text, 0 24px padding
- Circular Nav buttons: #f2f2f2 bg, 50% radius, hover shadow + translateX
- Cards: white bg, 20px radius, three-layer shadow, image-first layout
- Search: white bg, card shadow, pill-like rounding
- Border radius scale: 4px (subtle), 8px (buttons), 14px (badges), 20px (cards), 32px (large), 50% (circle)

**Quick Example**:
```css
/* Primary CTA Button */
.btn-primary {
  background: #222222;
  color: #ffffff;
  padding: 0px 24px;
  border-radius: 8px;
  font-family: 'Airbnb Cereal VF', sans-serif;
  font-weight: 500;
  font-size: 16px;
}
.btn-primary:hover {
  background: #ff385c; /* Rausch Red accent */
}

/* Circular Nav Control */
.btn-nav {
  background: #f2f2f2;
  border-radius: 50%;
  width: 48px;
  height: 48px;
}
.btn-nav:hover {
  box-shadow: rgba(0,0,0,0.08) 0px 4px 12px;
}

/* Listing Card */
.listing-card {
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 
    rgba(0,0,0,0.02) 0px 0px 0px 1px,
    rgba(0,0,0,0.04) 0px 2px 6px,
    rgba(0,0,0,0.1) 0px 4px 8px;
}
```

**Reference**: Full component specs at `/home/lucky/skills/DESIGN.md`

**Related**:
- lookup/airbnb-colors.md
- lookup/airbnb-typography.md
