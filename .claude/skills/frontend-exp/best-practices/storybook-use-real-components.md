---
title: Stories must use real components, not re-implementations
impact: MEDIUM
tags: storybook, testing, components
---

## Stories must use real components, not re-implementations

**Impact: MEDIUM**

Stories must import and render the **actual component**. A story may only add a decorator to supply required context — it must never re-implement the component's HTML/JSX structure.

When a story defines a `ComponentPreview` that duplicates the real component's markup, visual regressions in the actual component go undetected. The story keeps passing while the production UI silently diverges.

**Incorrect (preview component duplicates real markup — regressions are invisible):**

```tsx
// stories/chrome/Header.stories.tsx
function HeaderPreview({ title, subtitle }) {
  return (
    <div className="flex items-center px-6 bg-elevated border-b border-border">
      <div className="flex-1">
        <div className="text-xs text-secondary">{subtitle}</div>
        <div className="text-lg font-semibold">{title}</div>
      </div>
      {/* ... full re-implementation of Header markup ... */}
    </div>
  );
}
```

**Correct (use the real Header — visual regressions are caught automatically):**

```tsx
// stories/chrome/Header.stories.tsx
import { Header } from "@/components/Header";

const meta: Meta = {
  title: "Chrome/Header",
  component: Header,
  decorators: [
    (Story, ctx) => {
      // Provide required context via decorator, not re-implementation
      useStore.setState({ theme: ctx.args.theme ?? "light" });
      return <ThemeProvider><Story /></ThemeProvider>;
    },
  ],
};
```

Storybook decorators may provide context (theme providers, store initialization) but must not duplicate rendering logic. The component itself is the source of truth for what gets rendered.
