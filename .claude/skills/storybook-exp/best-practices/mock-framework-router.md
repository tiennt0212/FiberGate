---
title: Mock the framework router when Storybook doesn't natively support it
impact: HIGH
tags: storybook, nextjs, vite, mocking, routing
---

## Mock the framework router when Storybook doesn't natively support it

**Impact: HIGH**

When using `@storybook/react-vite` instead of `@storybook/nextjs`, alias the Next.js navigation module to a manual mock so components that call `usePathname()`, `useRouter()`, etc. render without errors.

Without the alias, any story that imports a component using these hooks throws at runtime: `"next/navigation" is not supported in this build`.

**Incorrect (no mock — Storybook throws on components that use framework hooks):**

```tsx
// No alias configured — Sidebar.stories.tsx fails at runtime
import { Sidebar } from "@/components/Sidebar"; // Sidebar uses usePathname()
```

**Correct (alias in Vite config + mock file for Next.js):**

**Step 1 — Create the mock file:**

```ts
// __mocks__/next/navigation.ts
import { fn } from "@storybook/test";

export const usePathname = fn().mockReturnValue("/");
export const useRouter = fn().mockReturnValue({
  push: fn(), replace: fn(), back: fn(), forward: fn(), refresh: fn(), prefetch: fn(),
});
export const useSearchParams = fn().mockReturnValue(new URLSearchParams());
export const useParams = fn().mockReturnValue({});
```

**Step 2 — Add the alias in `.storybook/main.ts`:**

```ts
// .storybook/main.ts
import path from "path";

const config = {
  // ...
  viteFinal: async (config) => {
    config.resolve!.alias = {
      ...config.resolve!.alias,
      "next/navigation": path.resolve(__dirname, "../__mocks__/next/navigation.ts"),
    };
    return config;
  },
};
```

**Step 3 — Override per-story to control active pathname:**

```tsx
import { fn } from "@storybook/test";
import { usePathname } from "next/navigation"; // resolves to mock

const meta: Meta<typeof Sidebar> = {
  title: "Chrome/Sidebar",
  component: Sidebar,
  decorators: [
    (Story, ctx) => {
      (usePathname as ReturnType<typeof fn>).mockReturnValue(ctx.args.activeRoute ?? "/");
      return <Story />;
    },
  ],
};
```

---

### React Router v6/v7

**Mock file (`__mocks__/react-router.ts`):**

```ts
import { fn } from "@storybook/test";

export const useNavigate = fn().mockReturnValue(fn());
export const useLocation = fn().mockReturnValue({ pathname: "/", search: "", hash: "", state: null });
export const useParams = fn().mockReturnValue({});
export const useMatch = fn().mockReturnValue(null);
// Re-export non-hook symbols from the real package so imports don't break
export { Link, NavLink, Outlet, Routes, Route } from "react-router";
```

**Alias in `.storybook/main.ts`:**

```ts
"react-router": path.resolve(__dirname, "../__mocks__/react-router.ts"),
```

**Per-story override:**

```tsx
(useLocation as ReturnType<typeof fn>).mockReturnValue({ pathname: "/dashboard", search: "", hash: "", state: null });
```

---

### TanStack Router

**Mock file (`__mocks__/@tanstack/react-router.ts`):**

```ts
import { fn } from "@storybook/test";

export const useNavigate = fn().mockReturnValue(fn());
export const useRouterState = fn().mockReturnValue({ location: { pathname: "/" } });
export const useParams = fn().mockReturnValue({});
export const useSearch = fn().mockReturnValue({});
export const Link = ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
  React.createElement("a", props, children);
```

**Alias in `.storybook/main.ts`:**

```ts
"@tanstack/react-router": path.resolve(__dirname, "../__mocks__/@tanstack/react-router.ts"),
```

---

The core principle is identical across all three: alias the router module to a mock file in `viteFinal`, then override per-story via decorators when you need a specific pathname.

Reference: [Storybook module mocking](https://storybook.js.org/docs/writing-stories/mocking-data-and-modules/mocking-modules)
