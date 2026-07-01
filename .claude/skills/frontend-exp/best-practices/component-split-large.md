---
title: Split large components by extracting JSX variable blocks into sub-components
impact: MEDIUM
tags: components, maintainability, organization, react, colocation
---

## Split large components by extracting JSX variable blocks into sub-components

**Impact: MEDIUM**

When a component stores large JSX trees in `const` variables (e.g. `const filterPanel = (...)`, `const detailPanel = (...)`), it is a signal that those blocks are already logically independent and should become their own co-located component files. Keeping them as inline variables makes the parent file hard to scan, prevents independent prop typing, and makes the sub-panel logic untestable without rendering the whole parent.

**Signals that a component needs splitting:**
- The file exceeds ~150 lines of JSX
- JSX is assigned to `const` variables before the `return` statement
- Each variable has its own distinct state or props
- The variable block reads like an independent UI concern (a dropdown panel, a modal, a card)

**Incorrect (large JSX stored in variables inside parent):**

```tsx
// PageLayout.tsx — 300+ lines, panels defined as inline variables
export function PageLayout() {
  const [filterOpen, setFilterOpen] = useState(false);

  const filterPanel = (           // ← independent UI block, not a component
    <div className="...">
      {FILTER_OPTIONS.map((opt) => (
        <button key={opt} onClick={() => { applyFilter(opt); setFilterOpen(false); }}>
          ...40 lines of JSX...
        </button>
      ))}
    </div>
  );

  const detailPanel = (           // ← another independent UI block
    <div className="...">
      ...50 lines of JSX...
    </div>
  );

  return (
    <div>
      <Dropdown popupRender={() => filterPanel}>...</Dropdown>
      <Drawer open={detailOpen}>{detailPanel}</Drawer>
    </div>
  );
}
```

**Correct (extract sub-components co-located beside the parent):**

```
app/components/
  PageLayout.tsx      ← layout only, ~80 lines
  usePageLayout.ts    ← state and derived values
  FilterPanel.tsx     ← filter trigger + dropdown
  DetailPanel.tsx     ← detail drawer content
```

```tsx
// PageLayout.tsx — only layout remains
export function PageLayout() {
  return (
    <div className="...">
      <PageHeader />
      <div className="flex gap-2">
        <FilterPanel />
        <DetailPanel />
      </div>
    </div>
  );
}
```

Sub-components are co-located in the same directory — they are not moved to `components/ui/` unless they are genuinely reusable across multiple pages or features.

> For extracting state and effects to a co-located hook, see `logic-extract-to-hooks`.
> For when to use `features/` vs co-location, see `features-folder-boundary`.
> For co-locating page-local components beside their page, see `component-colocation`.
