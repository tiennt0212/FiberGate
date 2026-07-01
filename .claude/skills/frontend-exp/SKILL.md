---
name: frontend-exp
description: General React + Next.js best practices for state management, routing, UI hierarchy, Storybook, TypeScript constants, and component colocation. ALWAYS consult this skill before writing new components, adding a route, choosing state management, or defining shared constants — these are foundational principles that apply to any React/Next.js project regardless of component library or CSS framework. Also consult for tech stack decisions and library trade-offs.
license: MIT
metadata:
  author: ckbuilder-team
  version: "2.0.0"
---

# Frontend Experience

General-purpose principles for React + Next.js (App Router) frontends. These are framework-level principles — they apply regardless of component library, CSS framework, or Storybook builder. For library-specific guidance, see Related Skills.

## When to Apply

- Adding a new route or nav item
- Choosing between React Context vs. a state management store
- Building or restyling UI components in any design system
- Writing Storybook stories
- Defining shared constants with TypeScript types
- Deciding where to place a new component file
- Setting up styling with design tokens
- Evaluating tech stack and library choices

## Best Practices by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | State Management | HIGH | `state-` |
| 2 | Routing & Navigation | MEDIUM | `routing-` |
| 3 | UI Components | MEDIUM | `ui-` |
| 4 | Storybook | MEDIUM | `storybook-` |
| 5 | TypeScript Constants | MEDIUM | `constants-` |
| 6 | Component Organization | LOW-MEDIUM | `component-`, `styling-`, `logic-`, `features-` |

## Quick Reference

### 1. State Management (HIGH)

- `state-singleton-stores` — Use singleton stores instead of React Context for global client state

### 2. Routing & Navigation (MEDIUM)

- `routing-single-source-of-truth` — All routes, page titles, and nav items live in one file
- `routing-semantic-navigation` — Navigation items must render real `<a>` elements

### 3. UI Components (MEDIUM)

- `ui-design-system-hierarchy` — Use design system first; override before building custom markup

### 4. Storybook (MEDIUM)

- `storybook-use-real-components` — Stories render the real component; never re-implement its markup
- For router mocking setup, see `storybook-exp`

### 5. TypeScript Constants (MEDIUM)

- `constants-guide` — All TypeScript constants conventions: derive types, object-as-namespace for comparisons, colocation, and placement in `lib/`

### 6. Component Organization (LOW-MEDIUM)

- `component-colocation` — Co-locate page-specific components beside their page file
- `component-split-large` — Extract inline JSX variable blocks into co-located sub-components when a file exceeds ~150 lines
- `styling-design-tokens` — Use CSS custom properties; never hardcode colors, sizes, or font values
- `logic-extract-to-hooks` — Extract state + async logic into a co-located custom hook when a component has >3 state vars or async effects
- `features-folder-boundary` — Use `app/features/<name>/` only for logic shared across multiple components in one domain; co-locate single-consumer logic instead

## Collab

- `collab/ecosystem.md` — State management, UI library, and routing trade-off comparison

## Creating New Content

For template formats and directory structure conventions, see `exp-blueprint`.
- New rule → `exp-blueprint/templates/best-practices-rule.md`
- New reminder → `exp-blueprint/templates/reminder.md`
- New collab file → `exp-blueprint/templates/collab-ecosystem.md`

## Related Skills

- `exp-blueprint` — Directory layout and template formats for all -exp skills
- `tailwind-v4-exp` — `@theme inline` token setup, `!` suffix modifier
- `storybook-exp` — Mocking Next.js navigation in `@storybook/react-vite`
- `antd-exp` — Ant Design v5 deprecated APIs and override patterns
