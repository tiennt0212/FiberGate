---
title: Co-locate page-specific components beside their page file
impact: LOW-MEDIUM
tags: components, organization, colocation, pages
---

## Co-locate page-specific components beside their page file

**Impact: LOW-MEDIUM**

When a page has a non-trivial form, section, or panel that is only used by that page, extract it into a file placed **beside `page.tsx`** in the same directory — not in a shared `components/` folder.

Putting every component in a central `components/` directory makes it impossible to tell what is shared vs. what is page-local. It also requires naming components to avoid collisions (`TransferPageForm` instead of `TransferForm`).

**Incorrect (page-local component placed in shared directory):**

```
app/
  components/
    TransferForm.tsx    ← only used by transfer/page.tsx
    SettingsPanel.tsx   ← only used by settings/page.tsx
  (shell)/
    transfer/
      page.tsx
    settings/
      page.tsx
```

**Correct (page-local components co-located with their page):**

```
app/
  components/
    ui/                 ← truly shared, reusable across pages
  (shell)/
    transfer/
      page.tsx
      TransferForm.tsx  ← co-located, clearly page-local
    settings/
      page.tsx
      SettingsPanel.tsx ← co-located, clearly page-local
```

Rule of thumb: if a component is only rendered by one page, it lives beside that page. If two pages render it, move it to `components/ui/`.
