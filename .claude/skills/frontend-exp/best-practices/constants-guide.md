---
title: TypeScript Constants Conventions
impact: MEDIUM
tags: typescript, constants, dry, organization, magic-strings
---

## TypeScript Constants Conventions

**Impact: MEDIUM**

Four rules that together describe how to define, organize, and use shared constants in a TypeScript frontend project. They build on each other — read them as a pipeline.

---

## Derive Types from Constants

Define shared value sets as `as const` arrays or objects. Derive the TypeScript type from the constant using `typeof` — never write a separate `type` or `enum` that duplicates the same values.

Declaring the type separately from the constant means two things to update when a value is added or removed.

**Incorrect (type and constant declared independently):**

```ts
// types.ts
export type Status = "pending" | "active" | "archived"; // declared separately

// constants.ts
export const STATUSES = ["pending", "active", "archived"]; // no `as const` — just string[]
```

**Correct (type derived from the constant):**

```ts
// lib/status.ts — array form
export const STATUSES = ["pending", "active", "archived"] as const;
export type Status = (typeof STATUSES)[number]; // derived, not re-declared

// lib/status.ts — object form (use when values are compared by name; see below)
export const Status = { Pending: "pending", Active: "active", Archived: "archived" } as const;
export type Status = (typeof Status)[keyof typeof Status]; // same union type
```

Both produce the same `"pending" | "active" | "archived"` union. Pick the form based on how the values are used.

---

## Use Object-as-Namespace for Comparisons

When constant values are compared with `===` at call sites, use the object form so comparisons use named keys rather than string literals.

Magic strings (`status === "active"`) pass TypeScript's type check, but they obscure intent and require text search to find all comparison sites. Named keys (`status === Status.Active`) are self-documenting and IDE-navigable.

**Incorrect (string literals scattered in comparisons):**

```ts
// lib/status.ts
export const STATUSES = ["pending", "active", "archived"] as const;
export type Status = (typeof STATUSES)[number];

// components/Badge.tsx — magic string
if (status === "active") { ... }

// utils/filter.ts — magic string again
const active = items.filter((i) => i.status === "active");
```

**Correct (object-as-namespace; type is still a string union):**

```ts
// lib/status.ts
export const Status = {
  Pending:  "pending",
  Active:   "active",
  Archived: "archived",
} as const;
export type Status = (typeof Status)[keyof typeof Status];
// → "pending" | "active" | "archived"  (string literals still assignable)

export const STATUSES = Object.values(Status) as Status[];
```

```ts
// components/Badge.tsx
if (status === Status.Active) { ... }

// utils/filter.ts
const active = items.filter((i) => i.status === Status.Active);
```

Type merging note: `Status` is both a value (`Status.Active`) and a type (`status: Status`). Consumers that only need the type annotation can still use `import { type Status }` — they just won't have access to `Status.Active`. Consumers that need to compare must use a value import: `import { Status }`.

---

## Colocate Related Constants

When a set of values (a list) and their associated metadata (a record keyed by those values) always change together, define them in the same module. Splitting related constants across files means multiple places to update when a value is added or removed.

**Incorrect (related constants split across files):**

```ts
// lib/environments.ts
export const ENVIRONMENTS = ["development", "staging", "production"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

// config/colors.ts — separate file, now two places to update
export const ENV_COLORS: Record<Environment, string> = {
  development: "#f59e0b",
  staging:     "#6366f1",
  production:  "#10b981",
};
```

**Correct (co-located in one module):**

```ts
// lib/environments.ts
export const Environment = {
  Development: "development",
  Staging:     "staging",
  Production:  "production",
} as const;
export type Environment = (typeof Environment)[keyof typeof Environment];
export const ENVIRONMENTS = Object.values(Environment) as Environment[];

export const ENV_COLORS: Record<Environment, string> = {
  development: "#f59e0b",
  staging:     "#6366f1",
  production:  "#10b981",
};
```

Rule of thumb: if adding a new value to the list requires updating a sibling `Record`, they belong in the same file.

---

## Domain Constants Belong in lib/

If a constant is a `Record` keyed by a shared domain type, it belongs in `lib/` — not in the component that happens to need it first. A component file signals "used here only." A `lib/` file signals "available to anyone."

Putting domain constants in a component makes them invisible to future consumers, who will either duplicate them or create a wrong-direction import (component → component).

**Incorrect (domain constants in a component file):**

```ts
// app/components/StatusBadge.tsx
const STATUS_LABELS: Record<Status, string> = {
  pending:  "Pending",
  active:   "Active",
  archived: "Archived",
};
```

A second consumer (e.g. a table row, a tooltip) must either duplicate this or import from a component — both are wrong.

**Correct (constants co-located with their type in lib/):**

```ts
// app/lib/status.ts
export const Status = { Pending: "pending", Active: "active", Archived: "archived" } as const;
export type Status = (typeof Status)[keyof typeof Status];
export const STATUSES = Object.values(Status) as Status[];

export const STATUS_LABELS: Record<Status, string> = {
  pending:  "Pending",
  active:   "Active",
  archived: "Archived",
};
```

**Exception — purely visual constants:** A constant that maps domain values to CSS strings for a specific design treatment (e.g. dot colors used only by one pill component) can stay in that component. It is not a domain constant — it is a styling decision other consumers would likely override anyway.

Rule of thumb: if the constant could be useful in a UI component, a server utility, or a test helper, it belongs in `lib/`. If it would only ever be used by one specific visual treatment, it can live closer to that component.
