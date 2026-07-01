---
title: Define design tokens with @theme inline in globals.css
impact: MEDIUM
tags: tailwind, tokens, css-variables, theme, globals
---

## Define design tokens with @theme inline in globals.css

**Impact: MEDIUM**

In Tailwind v4, design tokens are defined in a `@theme inline` block inside your main CSS file (typically `globals.css`). Each CSS variable automatically generates the corresponding Tailwind utility class — no `tailwind.config.ts` needed.

**Token definition:**

```css
/* globals.css */
@theme inline {
  --color-primary: #6366f1;
  --color-bg-elevated: #f8f9fa;
  --font-size-body: 13.5px;
  --font-size-title: 17px;
}
```

This single block creates `text-primary`, `bg-elevated`, `text-body`, `text-title` utility classes automatically.

**Using tokens in JSX:**

```tsx
// ✅ Reference token utility classes
<div className="text-primary text-body font-semibold">Balance</div>

// ❌ Hardcoding values defeats the token system
<div style={{ color: "#6366f1", fontSize: 13.5 }}>Balance</div>
```

**Runtime theming (light/dark mode):** Override token variables in theme classes rather than defining separate utility classes:

```css
.theme-light {
  --color-bg-elevated: #ffffff;
  --color-text-primary: #111827;
}
.theme-dark {
  --color-bg-elevated: #1a1a2e;
  --color-text-primary: #f9fafb;
}
```

The utility classes (`bg-elevated`, `text-primary`) resolve to the correct value at runtime based on whichever theme class is active on the root element.

Do NOT create `tailwind.config.ts` alongside `@theme inline` — token definitions belong in CSS only in v4.

Reference: [Tailwind v4 theme variables](https://tailwindcss.com/docs/theme)
