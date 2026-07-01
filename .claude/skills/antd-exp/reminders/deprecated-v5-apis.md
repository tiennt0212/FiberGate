---
title: Replace deprecated Ant Design v5 props
impact: MEDIUM
tags: antd, deprecated, card, select, dropdown, popup, api
---

## Replace deprecated Ant Design v5 props

**Impact: MEDIUM**

Several Ant Design props were deprecated in v5 and replaced with a unified `styles` object. Using the old props produces console warnings and will stop working in a future major version.

### Card `bodyStyle` → `styles.body`

```tsx
// ❌ Deprecated — console warning in v5
<Card bodyStyle={{ padding: 12 }}>…</Card>

// ✅ Correct v5 API
<Card styles={{ body: { padding: 12 } }}>…</Card>
```

The `styles` prop accepts an object with keys for each internal slot (`body`, `header`, `cover`, `actions`, `extra`), giving fine-grained control without CSS overrides.

Reference: [Ant Design Card API](https://ant.design/components/card)

### Select / Cascader / TreeSelect `dropdownRender` → `popupRender`

```tsx
// ❌ Deprecated — console warning in v5.15+
<Select dropdownRender={(menu) => <>{menu}</>} />

// ✅ Correct API
<Select popupRender={(menu) => <>{menu}</>} />
```

Affects all popup-based components: `Select`, `Cascader`, `TreeSelect`, `TimePicker`, `DatePicker`, `AutoComplete`. The rename unifies the naming convention (`popup*`) across these components.

Reference: [Ant Design Select API](https://ant.design/components/select)
