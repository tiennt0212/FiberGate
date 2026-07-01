---
title: React + Next.js — Collab & Tech Stack Choices
verified-against: "Next.js 15, React 19, Node.js 20+"
last-verified: "2025-06"
---

## State Management — When to Choose What

| Library | Use when | Avoid when |
|---|---|---|
| **Zustand** | Simple global state, Storybook-friendly, small API | Need fine-grained atom subscriptions |
| **Jotai** | Atomic state, many small independent slices | Simple cases (overkill) |
| **TanStack Query** | Server state, caching, background refetch | Pure client-side state |
| **Nanostores** | Framework-agnostic, shared between React + non-React | React-only projects (Zustand simpler) |
| **React Context** | Tree-scoped side effects only (theme, locale) | Global client state (causes re-render issues) |
| **Redux Toolkit** | Large teams, complex state machines, existing Redux codebase | New projects (Zustand simpler) |

## UI Component Libraries

| Library | Collab quality | Best paired with |
|---|---|---|
| **Ant Design 5.x** | ✅ | Tailwind v4 overrides, Zustand, Next.js. See `antd-exp/collab/ecosystem`. |
| **shadcn/ui** | ✅ | Tailwind v4 (designed for it), Radix UI primitives |
| **Radix UI** | ✅ | Tailwind v4 (headless, full styling control) |
| **MUI** | ⚠️ | Standalone — doesn't pair well with Tailwind |

## Routing

| | **Next.js App Router** | **Next.js Pages Router** | **React Router v7** | **TanStack Router** |
|---|---|---|---|---|
| Use when | New Next.js projects, RSC needed | Existing Pages Router app | Vite SPA, non-Next.js | Type-safe routes critical |
| File-based routing | ✅ | ✅ | ❌ (manual) | ❌ (manual or plugin) |
| SSR/RSC | ✅ Full | ✅ SSR only | ❌ | ❌ |

## Data Fetching

| | **TanStack Query** | **SWR** | **fetch (native)** |
|---|---|---|---|
| Use when | Complex caching, mutations, optimistic updates | Simple GET caching, lightweight | Server Components (no client state needed) |
| Bundle size | Larger | Small | Zero |

## Collab with Storybook

- **`@storybook/react-vite`** — best for Vite projects. Needs manual router mock. See `storybook-exp`.
- **`@storybook/nextjs`** — native Next.js adapter, handles App Router automatically. Preferred if you want zero mock setup.
- **Chromatic** — visual regression testing, pairs with either Storybook setup.

---

## When to Re-verify

Re-check if:
- [ ] Next.js 16 is released (App Router changes)
- [ ] React 20 is released (concurrent features / hooks changes)
- [ ] User asks about a state management library not listed here

**Search queries:**
```
"next.js 16 release"
"zustand vs jotai 2025 comparison"
"react server components state management"
```

## Propose Updates

If you discover new compatibility or ecosystem information:
1. Add under the relevant section with `<!-- source: URL -->`
2. Update `last-verified` in frontmatter
3. Tell the user: "Found updated collab info — updated frontend-exp/collab/ecosystem.md"
