---
title: Navigation items must render real anchor elements
impact: MEDIUM
tags: routing, accessibility, nextjs, navigation
---

## Navigation items must render real anchor elements

**Impact: MEDIUM**

Wrap each navigation menu item's label in the framework's `<Link>` component so it renders as a real `<a>` tag. Do not use `onClick` + `router.push()` on the menu container — the `<Link>` handles navigation entirely.

`router.push()` produces no `<a>` element, so right-click "Open in new tab", middle-click, and Cmd+click do not work. `<Link>` renders a proper `<a>`, satisfying accessibility requirements and enabling all browser-native navigation gestures.

**Incorrect (no `<a>` element — "Open in new tab" is impossible):**

```tsx
<NavMenu
  items={[{ key: "/transfer", label: "Transfer" }]}
  onClick={({ key }) => router.push(key)}
/>
```

**Correct (`<Link>` in label — no onClick needed on the menu):**

```tsx
import Link from "next/link";

const navItems = [
  {
    key: "/transfer",
    label: <Link href="/transfer">Transfer</Link>,
  },
];

// No onClick — <Link> handles navigation
<NavMenu items={navItems} />
```

This pattern applies to any component library. Render `<Link>` inside the label slot; the outer component provides styling and active state, the `<Link>` provides the anchor.

Note: If the component library's default link color overrides your design system's color, apply a color-inherit utility class to the `<Link>` (e.g. `className="text-inherit"` or `color: inherit`).
