---
title: Override Ant Design components with utility classes
impact: MEDIUM
tags: antd, tailwind, overrides, menu, link, tag, button, card
---

## Override Ant Design components with utility classes

**Impact: MEDIUM**

Apply utility classes via `className` to tweak Ant Design components without writing custom components or duplicating Antd's internal logic.

### Common override patterns

Replace `{your-token}` with the design token names defined in your project's `globals.css` (or equivalent).

```tsx
// Remove border, apply design token colors to Tag
<Tag className="border-0 bg-{your-accent-tint} text-{your-accent} text-xs">Active</Tag>

// Tighten padding on Button (Tailwind v4: ! is a suffix)
<Button size="small" className="px-2! h-7! text-xs">Copy</Button>

// Card with token background and custom body padding
<Card
  className="bg-{your-elevated-bg} border-{your-border}"
  styles={{ body: { padding: 12 } }}
>
  …
</Card>
```

The override mechanism is the same regardless of token names — `className` for visual properties, `styles` prop for internal slot padding/sizing.

> For `<Link>` color inside Menu items, see `reminders/link-color-reset`.

> For Tailwind v4 important modifier syntax (`px-2!` vs `!px-2`), see `tailwind-v4-exp/best-practices/important-modifier`.
