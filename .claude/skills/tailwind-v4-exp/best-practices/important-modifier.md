---
title: The important modifier is a suffix in Tailwind v4
impact: HIGH
tags: tailwind, important, override, breaking-change
---

## The important modifier is a suffix in Tailwind v4

**Impact: HIGH**

In Tailwind CSS v4, the `!` important modifier is placed **after** the utility name, not before it. Using the v3 prefix form silently fails — no error, no override, no warning.

**Incorrect (v3 prefix form — silently ignored in v4):**

```tsx
// ❌ Produces no !important — the override never applies
<Button className="!px-2 !h-7 !text-xs">Copy</Button>
```

**Correct (v4 suffix form):**

```tsx
// ✅ Suffix applies !important correctly
<Button className="px-2! h-7! text-xs!">Copy</Button>
```

This applies to every utility: spacing, sizing, colors, typography, display. Whenever you need to override a component library's cascaded styles, use the suffix form.

Silent failure is the main danger: the class appears in the DOM but has no effect, and there's no console warning. If an override "isn't working", check the `!` position first.

Reference: [Tailwind v4 important modifier docs](https://tailwindcss.com/docs/styling-with-utility-classes#using-the-important-modifier)
