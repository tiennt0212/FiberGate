---
title: Reset link color inside component library menu items
type: gotcha
applies-to: Ant Design Menu + any framework Link component
---

## Link color override inside Menu items

Wrapping a menu item's label in a framework `<Link>` applies the framework's default link color (blue), overriding the component library's cascaded text color.

Fix with `color: inherit` — use your CSS framework's utility for this:

| CSS framework | Class to use |
|---|---|
| Tailwind v4 | `className="text-inherit!"` |
| Tailwind v3 | `className="!text-inherit"` |
| Plain CSS | `style={{ color: "inherit" }}` |

```tsx
// Next.js — same principle applies for React Router <NavLink>, etc.
import Link from "next/link";

const items = [
  {
    key: "/transfer",
    label: <Link href="/transfer" className="text-inherit!">Transfer</Link>,
  },
];
```

`color: inherit` lets the component library's active/hover state cascade through normally.

> For Tailwind v4 important modifier syntax, see `tailwind-v4-exp/best-practices/important-modifier`.
