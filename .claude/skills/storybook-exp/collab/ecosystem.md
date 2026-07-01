---
title: Storybook — Collab & Integration
verified-against: "Storybook 8.x, @storybook/react-vite, Next.js 15"
last-verified: "2025-06"
---

## Builder Choice — @storybook/react-vite vs @storybook/nextjs

| | **@storybook/react-vite** | **@storybook/nextjs** |
|---|---|---|
| Use when | Any React project, Vite-based, framework-agnostic | Next.js project, want zero mock setup |
| Router mocking | Manual (see `storybook-exp/best-practices/mock-framework-router`) | Built-in |
| RSC support | ❌ | Partial (v8.4+) |
| Speed | Faster (Vite HMR) | Slower (Next.js internals) |

## Works Well With

| Library | Collab quality | Notes |
|---|---|---|
| **Tailwind CSS v4** | ✅ Good | Import `globals.css` in `.storybook/preview.ts`. Tokens and utilities available in all stories. |
| **Ant Design** | ✅ Good | Wrap stories in `ConfigProvider` decorator for theme consistency. |
| **Zustand** | ✅ Excellent | Initialize store state via decorator without Provider wrapper — key advantage over Context. |
| **Chromatic** | ✅ Excellent | Automated visual regression. Connect CI to Storybook build. |
| **MSW (Mock Service Worker)** | ✅ Good | Use `msw-storybook-addon` for API mocking in stories. |
| **React Query** | ⚠️ Needs config | Wrap stories in `QueryClientProvider` decorator with a fresh client per story. |

## Known Friction

- **`@storybook/react-vite` + `next/navigation`** — throws "not supported in this build" without alias. See `storybook-exp/best-practices/mock-framework-router`.
- **Ant Design + Storybook dark mode** — Antd uses `ConfigProvider` for theming, not CSS class on `<html>`. The standard `storybook-dark-mode` addon may not sync. Use a custom decorator that reads the story's background and passes the matching Antd theme.
- **RSC (React Server Components) in stories** — neither adapter fully supports RSC stories as of 2025. RSC-heavy components need a client wrapper for stories.

## Avoid Pairing

- **Multiple Storybook adapters** — pick one builder per project. Mixing `@storybook/nextjs` and `@storybook/react-vite` causes config conflicts.

---

## When to Re-verify

Re-check if:
- [ ] Storybook 9 is released
- [ ] `@storybook/nextjs` adds full RSC story support
- [ ] User hits runtime errors with a specific framework version

**Search queries:**
```
"storybook 9 release"
"storybook nextjs rsc server components support"
"storybook react-vite next/navigation mock [year]"
```

## Propose Updates

If you discover new compatibility information:
1. Add under the relevant section with `<!-- source: URL -->`
2. Update `last-verified` in frontmatter
3. Tell the user: "Found updated collab info — updated storybook-exp/collab/ecosystem.md"
