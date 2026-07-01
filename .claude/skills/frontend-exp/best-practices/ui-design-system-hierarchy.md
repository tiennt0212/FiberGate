---
title: Follow design system hierarchy before writing custom markup
impact: MEDIUM
tags: ui, components, design-system, tailwind
---

## Follow design system hierarchy before writing custom markup

**Impact: MEDIUM**

Follow this decision order before writing any UI element. Stop at the first match:

1. **Design system has it** → use it. Apply utility classes or inline `style` for visual tweaks.
2. **Design system has it but needs heavier restyling** → use it with a CSS override on the wrapping element. Do not duplicate the library's logic in a custom component.
3. **`components/ui/` has a domain-specific wrapper** → use that wrapper.
4. **Nothing fits** → build a new `ui/` component composing design system primitives.

This applies to **all** component categories — not just display elements, but interactive and structural patterns too. Developers most often rebuild these unnecessarily:

| Pattern | Check the library for… |
|---|---|
| Status chip / badge | `Tag`, `Badge` |
| Slide-in panel | `Drawer` |
| Collapsible section | `Collapse` |
| Pop-up dialog | `Modal` |
| Dropdown list | `Select`, `Dropdown` |
| Tab bar | `Tabs` |
| Tooltip / hint | `Tooltip`, `Popover` |

When in doubt about usage patterns: **`ui/` wrappers** → see the Storybook story (`stories/components/<Name>.stories.tsx`). **Raw library components** (Drawer, Collapse, Modal…) → see the library's official docs.

Writing custom `<span>` or `<div>` markup for elements that the design system already provides (Badge, Tag, Avatar, Tooltip…) duplicates styling logic and drifts from the design system.

**Incorrect (hand-rolled badge using a `<span>`):**

```tsx
// ❌ Custom markup — padding, border-radius, font-size all hardcoded
<span style={{ padding: "2px 6px", borderRadius: 4, background: "#e0e7ff", color: "#6366f1", fontSize: 11 }}>
  Active
</span>
```

**Correct (design system component with utility overrides):**

```tsx
// ✅ Design system Tag + token classes — no custom markup
import { Tag } from "antd"; // or Badge from shadcn/ui, etc.

<Tag className="border-0 bg-primary-tint text-primary text-xs">Active</Tag>
```

Common override patterns (adjust for your design system):

```tsx
// Tighten padding
<Button size="small" className="px-2 h-7 text-xs">Copy</Button>

// Custom background via wrapper
<Card className="bg-elevated border-border" style={{ borderRadius: 8 }}>…</Card>

// Composing primitives in a ui/ wrapper
// components/ui/StatusChip.tsx
export function StatusChip({ status }: { status: string }) {
  return <Tag className={STATUS_COLORS[status]}>{status}</Tag>;
}
```

> For Tailwind v4 important modifier syntax (`px-2!` vs `!px-2`), see `tailwind-v4-best-practices/important-modifier`.
