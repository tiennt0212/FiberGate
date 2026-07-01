---
title: Define routes as constants — single source of truth
impact: MEDIUM
tags: routing, constants, dry, navigation
---

## Define routes as constants — single source of truth

**Impact: MEDIUM**

All route paths, page titles, and nav item definitions live in one dedicated file (e.g. `lib/routes.ts` for constants, `lib/nav-items.tsx` for JSX menu items). Sidebar, Header, breadcrumbs, and their Storybook stories all import from these files — nothing is duplicated.

Route strings repeated verbatim across multiple files mean renaming a route touches every Sidebar, Header, story, and `router.push()` call site.

**Incorrect (route strings and titles duplicated across files):**

```tsx
// Sidebar.tsx
const menuItems = [{ key: "/transfer", label: "Transfer" }];

// Header.tsx
const PAGE_TITLES = { "/transfer": { group: "Wallet", title: "Transfer" } };

// Sidebar.stories.tsx — duplicated again
const menuItems = [{ key: "/transfer", label: "Transfer" }];
```

**Correct (single source of truth — type derived from constants):**

```ts
// lib/routes.ts
export const ROUTES = {
  TRANSFER: "/transfer",
  SETTINGS: "/settings",
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];

export const PAGE_TITLES: Record<Route, { group: string; title: string }> = {
  [ROUTES.TRANSFER]: { group: "Wallet", title: "Transfer" },
  [ROUTES.SETTINGS]: { group: "App", title: "Settings" },
};
```

```tsx
// lib/nav-items.tsx
export const NAV_ITEMS = [
  { key: ROUTES.TRANSFER, label: <Link href={ROUTES.TRANSFER}>Transfer</Link> },
  { key: ROUTES.SETTINGS, label: <Link href={ROUTES.SETTINGS}>Settings</Link> },
];
```

When adding a new route: add the constant to `ROUTES`, add an entry to `PAGE_TITLES`, and add an item to `NAV_ITEMS`. No other files need to change.
