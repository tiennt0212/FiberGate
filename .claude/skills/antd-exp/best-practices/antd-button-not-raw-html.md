---
title: Use Antd Button instead of raw <button> for action items
impact: MEDIUM
tags: antd, components, accessibility, ui
---

## Use Antd Button instead of raw `<button>` for action items

**Impact: MEDIUM**

When a clickable element is a simple action (icon + label, label only, or icon only), use `<Button type="text">` from Ant Design — not a raw `<button>`. Raw `<button>` bypasses Antd's built-in focus ring, disabled state, and loading indicator. It also means manually maintaining hover/active states that `Button` provides.

Override visual properties with Tailwind `!` suffix rather than rebuilding from scratch.

**Incorrect (raw `<button>` for a simple action item):**

```tsx
<button
  onClick={() => { close(); disconnect(); }}
  className="flex items-center gap-2 w-full px-4 py-2 text-body text-[#c0683a] hover:bg-[rgba(192,104,58,0.08)]"
>
  <PoweroffOutlined style={{ fontSize: 13 }} />
  Disconnect
</button>
```

**Correct (`Button type="text"` with Tailwind overrides):**

```tsx
<Button
  type="text"
  icon={<PoweroffOutlined style={{ fontSize: 13 }} />}
  onClick={() => { close(); disconnect(); }}
  className="w-full! justify-start! px-4! py-2! h-auto! text-body! text-rust! hover:bg-rust-tint! hover:text-rust!"
>
  Disconnect
</Button>
```

**When raw `<button>` is justified:**

A raw `<button>` is correct when the element needs complex internal flex layout that `Button` cannot support cleanly — for example, a pill trigger containing a colored dot + multi-line label + chevron icon. In these cases, the element is a structural container, not a simple action item.

Rule of thumb: if removing the children and just having text + optional icon still makes sense as a `Button`, use `Button`. If the element's children define a custom layout (multi-column, dot indicators, stacked text), a raw `<button>` is acceptable.

> For Tailwind v4 important modifier syntax (`px-4!` not `!px-4`), see `tailwind-v4-exp/best-practices/important-modifier`.
