---
title: Reference design tokens — never hardcode colors, sizes, or font values
impact: LOW-MEDIUM
tags: styling, design-tokens, css, tailwind
---

## Reference design tokens — never hardcode colors, sizes, or font values

**Impact: LOW-MEDIUM**

Use CSS custom properties (`var(--color-primary)`) or design token utility classes (`text-primary`, `bg-elevated`) instead of raw hex codes, pixel values, or font weights. Design tokens are defined once in a central CSS file; components reference them by name.

Hardcoded values drift out of sync with the design system when tokens change. A token rename or theme update requires updating every hardcoded occurrence instead of just the definition.

**Incorrect (raw values — break when tokens change):**

```tsx
// ❌ Hardcoded hex, px, font-weight
<div style={{ color: "#6366f1", fontSize: 13.5, fontWeight: 600 }}>
  Balance
</div>
```

**Correct (token references — update in one place):**

```tsx
// ✅ CSS custom property or utility class derived from a token
<div style={{ color: "var(--color-primary)" }} className="text-body font-semibold">
  Balance
</div>
```

Tokens are defined once and referenced everywhere:

```css
/* Design token definition (framework-agnostic) */
:root {
  --color-primary: #6366f1;
  --color-bg-elevated: #f8f9fa;
  --font-size-body: 13.5px;
}
```

For values with no named token equivalent (e.g. a one-off pixel adjustment), arbitrary values (`px-[5px]`) are acceptable — but avoid creating a pattern of hardcoding semantic values like brand colors or typography sizes.

> For Tailwind v4 token setup (`@theme inline` syntax and utility class generation), see `tailwind-v4-best-practices/theme-tokens`.
