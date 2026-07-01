---
title: Ant Design — Collab & Integration
verified-against: "antd 5.x, Next.js 15, Tailwind CSS v4, React 19"
last-verified: "2025-06"
---

## Works Well With

| Library | Collab quality | Notes |
|---|---|---|
| **Tailwind CSS v4** | ✅ Good | Use `className` for overrides; suffix `!` for important. No CSS Modules needed. |
| **Next.js App Router** | ✅ Good | Requires `AntdRegistry` from `@ant-design/nextjs-registry` to avoid SSR flash. |
| **Zustand** | ✅ Good | State ko conflict với Antd ConfigProvider. Storybook-friendly. |
| **React Query / SWR** | ✅ Good | Antd Form works alongside — use `form.setFieldsValue` to sync fetched data. |
| **Framer Motion** | ⚠️ Needs config | Wrap Antd components in `motion.div`; animating Antd's internal DOM directly causes issues. |

## Known Friction

- **CSS Modules** — specificity conflicts with Antd's inline-injected styles. Antd injects styles at runtime; CSS Modules may lose the specificity battle without `!important`.
- **Tailwind's `preflight`** — Antd ships its own CSS reset. Both running together can cause double-reset artifacts (especially on `<a>` and `<button>`). Disable Tailwind preflight if using Antd's own reset.
- **React 19 strict mode** — some Antd v5 animations trigger double-effect warnings. Not a runtime bug, but noisy in dev.

## Avoid Pairing

- **MUI (Material UI)** — same scope, different design language. Two component libraries in one app creates a maintenance burden and inconsistent UX.
- **Chakra UI** — same reason. Pick one design system per app.
- **Ant Design + CSS-in-JS libraries (emotion/styled-components)** — Antd v5 already uses CSS-in-JS internally (cssinjs). Adding a second CSS-in-JS runtime doubles the style injection overhead.

## Trade-off vs Alternatives

| | **Ant Design** | **shadcn/ui** | **MUI** |
|---|---|---|---|
| Use when | Enterprise dashboards, data-heavy UIs, need full component set out of the box | Want full control over markup & styling, Tailwind-first | Material Design required, or migrating from older MUI project |
| Styling | Utility class overrides + `styles` prop | Tailwind-first, copy-paste ownership | `sx` prop / styled-components |
| Bundle size | Larger (tree-shakeable) | Minimal (you own the code) | Larger |
| Customization effort | Medium (ConfigProvider + overrides) | Low (you edit the source) | High (theme overrides complex) |

---

## When to Re-verify

Re-check this content if:
- [ ] antd v6 is released (watch: [ant.design/changelog](https://ant.design/changelog))
- [ ] Next.js releases a major version with changed SSR behavior
- [ ] Tailwind v5 is released (may affect override patterns)
- [ ] User reports SSR flash or style injection issues

**Search queries:**
```
"ant design v6 release date"
"antd tailwind css v4 compatibility 2025"
"@ant-design/nextjs-registry next 15 app router"
```

## Propose Updates

If you discover new compatibility information:
1. Add under the relevant section with `<!-- source: URL -->`
2. Update `last-verified` in frontmatter
3. Tell the user: "Found updated collab info — updated antd-exp/collab/ecosystem.md"
