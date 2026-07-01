---
title: Use features/ only for logic shared across multiple components in one domain
impact: LOW-MEDIUM
tags: organization, architecture, colocation, features
---

## Use `features/` only for logic shared across multiple components in one domain

**Impact: LOW-MEDIUM**

`app/features/<name>/` is for feature-scoped hooks and utilities that need to be shared across **more than one component or page within the same feature domain**. It is not a dumping ground for all non-component code.

Misusing `features/` by placing single-consumer logic there makes it impossible to tell what is truly shared vs. what belongs to one component.

**Decision tree — where does logic live?**

```
Logic is used by…
├── 1 component only
│   └── Co-locate beside the component file (same directory)
├── Multiple components within the same feature domain
│   └── app/features/<name>/use<Hook>.ts
└── Multiple feature domains (truly cross-cutting)
    └── app/lib/<utility>.ts
```

**Incorrect (single-consumer logic in features/):**

```
app/
  features/
    header/
      useHeaderState.ts   ← only used by Header.tsx — should be co-located
  components/
    Header.tsx
```

**Correct:**

```
app/
  components/
    Header.tsx
    useHeader.ts          ← co-located, clearly Header-only
  features/
    transfer/
      useTransferForm.ts  ← used by TransferForm.tsx AND a validation helper
```

**When features/ is the right call:**

A transfer feature might have `useTransferForm` (used in `TransferForm.tsx`) and `useTransferHistory` (used in both the form and a `RecentTransfers` panel). Both live in `features/transfer/` because they are distinct entry points into the same domain and are consumed by sibling components.

> For extracting logic from a single component, see `logic-extract-to-hooks`.
> For where to place shared constants, see `constants-colocate-related`.
