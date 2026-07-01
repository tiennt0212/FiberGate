---
name: storybook-exp
description: Storybook setup patterns for React projects using @storybook/react-vite — aliasing Next.js, React Router v6/v7, or TanStack Router navigation modules in viteFinal, writing mock files for usePathname/useRouter/useNavigate/useLocation, and controlling the active route per-story via decorators. ALWAYS consult this skill when setting up Storybook, writing stories for components that call any framework navigation hook, or when a story throws any runtime error mentioning navigation, router, or "not supported in this build".
license: MIT
metadata:
  author: ckbuilder-team
  version: "2.0.0"
---

# Storybook Experience

Implementation patterns for Storybook with React frameworks. Covers the common gap when using `@storybook/react-vite` (not the native framework adapter), where router hooks must be manually mocked.

## When to Apply

- Setting up Storybook in a project using `@storybook/react-vite`
- Writing stories for components that use `usePathname()`, `useRouter()`, or `useParams()`
- Debugging Storybook runtime errors like `"next/navigation" is not supported in this build`
- Controlling which route is "active" in a navigation component story
- Any story that throws at runtime with an error mentioning navigation or router

## Best Practices

| Priority | Rule | Impact |
|----------|------|--------|
| 1 | `mock-framework-router` — Alias the framework router module to a manual mock; override per-story via decorator | HIGH |

See also: `frontend-exp/best-practices/storybook-use-real-components` — Stories must render the real component, never re-implement its markup.

## Collab

- `collab/ecosystem.md` — `@storybook/react-vite` vs `@storybook/nextjs`, Tailwind, Zustand, MSW, Chromatic

## Creating New Content

For template formats and directory structure conventions, see `exp-blueprint`.
- New rule → `exp-blueprint/templates/best-practices-rule.md`
- New reminder → `exp-blueprint/templates/reminder.md`
- New collab file → `exp-blueprint/templates/collab-ecosystem.md`

## Related Skills

- `exp-blueprint` — Directory layout and template formats for all -exp skills
- `frontend-exp` — `storybook-use-real-components` rule: stories must use real components
- `antd-exp` — Antd ConfigProvider decorator pattern for Storybook theming
