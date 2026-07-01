---
title: Tailwind CSS v4 — Collab & Integration
verified-against: "Tailwind CSS v4.x, Next.js 15, Vite 6"
last-verified: "2025-06"
---

## Works Well With

| Library | Collab quality | Notes |
|---|---|---|
| **Ant Design 5.x** | ✅ Good | Use `className` overrides; suffix `!` for specificity wins. See `antd-exp/collab/ecosystem`. |
| **shadcn/ui** | ✅ Excellent | Designed specifically for Tailwind. Tokens align naturally. |
| **Radix UI** | ✅ Excellent | Headless + Tailwind is the canonical pairing. Full styling control. |
| **Next.js App Router** | ✅ Good | Import `globals.css` in root layout. No extra config needed for v4. |
| **Vite** | ✅ Good | Use `@tailwindcss/vite` plugin. No PostCSS config needed in v4. |
| **Storybook (Vite)** | ✅ Good | Import `globals.css` in `.storybook/preview.ts`. Tokens available in stories. |
| **CSS Modules** | ⚠️ Redundant | Can coexist, but rarely needed alongside Tailwind. Adds cognitive overhead. |

## Known Friction

- **PostCSS-based build setups** — Tailwind v4 prefers the Vite plugin or CLI. Using it via PostCSS still works but is the "legacy" path and may lag on new features.
- **Tailwind v3 projects** — v3 and v4 config is incompatible. `tailwind.config.ts` from v3 does nothing in v4. All tokens must move to `@theme inline` in CSS.
- **CSS-in-JS libraries (emotion, styled-components)** — class name conflicts can occur when both inject `<style>` tags. Prefer utility classes over CSS-in-JS when using Tailwind.

## Avoid Pairing

- **Bootstrap** — same scope (utility/component classes). Naming conflicts and redundancy.
- **Windi CSS / UnoCSS** — if already on Tailwind, switching mid-project is expensive. Pick one.

## Trade-off vs Alternatives

| | **Tailwind v4** | **Tailwind v3** | **CSS Modules** | **Vanilla CSS / PostCSS** |
|---|---|---|---|---|
| Use when | New projects, Vite/Next.js, design token system | Existing v3 codebase, wide plugin ecosystem | Component isolation required, no design system | Full control, no framework opinions |
| Token setup | `@theme inline` in CSS | `tailwind.config.ts` | CSS custom properties | CSS custom properties |
| Important override | Suffix `px-2!` | Prefix `!px-2` | N/A | `!important` |
| Config file needed | ❌ No | ✅ Yes | N/A | Optional |

---

## When to Re-verify

Re-check if:
- [ ] Tailwind v5 is released (breaking changes likely)
- [ ] A major Vite or Next.js version changes CSS handling
- [ ] User reports `@theme inline` tokens not generating utility classes

**Search queries:**
```
"tailwind css v5 release"
"tailwind v4 vite plugin breaking changes"
"@theme inline not working [framework] [year]"
```

## Propose Updates

If you discover new compatibility information:
1. Add under the relevant section with `<!-- source: URL -->`
2. Update `last-verified` in frontmatter
3. Tell the user: "Found updated collab info — updated tailwind-v4-exp/collab/ecosystem.md"
