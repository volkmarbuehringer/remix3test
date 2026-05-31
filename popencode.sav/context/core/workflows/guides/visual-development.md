<!-- Context: core/visual-development | Priority: high | Version: 1.1 | Updated: 2026-03-27 -->

# Visual Development Context

**Purpose**: Generate images, diagrams, mockups using Image Specialist subagent.

## Quick Reference

| Task                   | Context                                  | Tool             |
| ---------------------- | ---------------------------------------- | ---------------- |
| Generate image/diagram | This file                                | Image Specialist |
| Edit existing image    | This file                                | Image Specialist |
| UI mockup (static)     | This file                                | Image Specialist |
| Interactive UI         | `workflows/design-iteration-overview.md` | -                |

---

## Image Specialist

### When to Use

Use for: diagrams, mockups, graphics, icons, illustrations, image editing.

**Keywords**: "create image", "generate", "diagram", "mockup", "graphic", "icon"

**Avoid for**: Interactive HTML/CSS (use design-iteration workflow)

### How to Invoke

```javascript
task(
  subagent_type="Image Specialist",
  description="[Brief 3-5 word description]",
  prompt="Context: .opencode/context/core/visual-development.md

Task: [Detailed visual requirement]

Requirements:
- Style: [modern, minimalist, professional]
- Dimensions: [Width x Height]
- Key Elements: [What must be included]
- Colors: [Hex codes or brand colors]
- Format: [PNG, JPG, SVG]

Output: [Expected deliverable location]"
)
```

### Example Templates

**Architecture Diagram**:

- Services: API Gateway, Auth, User, Order, Payment
- Infrastructure: PostgreSQL, Redis, RabbitMQ, S3
- External: Stripe, SendGrid, Twilio
- Style: Clean, professional, left-to-right flow

**UI Mockup**:

- Header with logo/nav, 4 metric cards, chart, data table
- Style: Dark mode SaaS (#1e293b bg, #334155 cards, #3b82f6 accent)

**Flowchart**:

- Steps with decision points
- Style: Standard symbols, color-coded (green=start/end, blue=process, yellow=decision)

---

## Best Practices

### ✅ Do

- Specify dimensions and format explicitly
- Describe visual style clearly
- Include hex color codes
- State key elements that must appear
- Provide output location

### ❌ Don't

- Use vague descriptions ("make it nice")
- Forget dimensions
- Skip color specifications
- Omit output location

---

## Configuration

**Required**: `GEMINI_API_KEY` in `.env`

Get key: https://makersuite.google.com/app/apikey

**Capabilities**:

- Text-to-image generation
- Image-to-image editing
- PNG, JPG, WebP support
- Up to 2048x2048 resolution

---

## Decision Tree

```
User needs visual content
    ↓
Is it interactive HTML/CSS?
  YES → design-iteration-overview.md workflow
  NO → Is it a static visual?
    YES → Image Specialist
    NO → Clarify requirements
```

---

## Related

- `workflows/design-iteration-overview.md` - Interactive UI
- `ui/web/design-systems.md` - Design systems
- `ui/web/ui-styling-standards.md` - UI standards
- `openagents-repo/guides/subagent-invocation.md` - Agent invocation
