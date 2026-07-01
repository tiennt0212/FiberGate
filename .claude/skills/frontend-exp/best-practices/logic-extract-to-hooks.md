---
title: Extract component logic to co-located custom hooks
impact: MEDIUM
tags: hooks, testability, maintainability, react
---

## Extract component logic to co-located custom hooks

**Impact: MEDIUM**

When a component accumulates multiple async side-effects, more than three state variables, or non-trivial derived values, extract the logic into a custom hook in the same directory. The hook owns state, effects, and derived values — the component only renders.

This separation makes the logic independently testable (no DOM required), keeps the component file scannable, and makes the component easier to refactor or replace.

**Signal that extraction is needed:** the component imports more than five modules, has `useEffect` with async calls, or contains a conditional/switch that maps state to display values.

**Incorrect (logic and render mixed in one component):**

```tsx
// UserCard.tsx — state, async effect, derived values, AND render all together
export function UserCard({ userId }: { userId: string }) {
  const { currentUser } = useAuthStore();
  const [profile, setProfile] = useState<Profile | undefined>(undefined);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!userId) { setProfile(undefined); return; }
    fetchProfile(userId).then(setProfile).catch(() => setProfile(undefined));
  }, [userId]);

  const isOwner = currentUser?.id === userId;
  const displayName = profile ? formatName(profile) : undefined;
  // ... more JSX
}
```

**Correct (logic in hook, component only renders):**

```tsx
// useUserCard.ts — co-located in app/components/
export function useUserCard(userId: string) {
  const { currentUser } = useAuthStore();
  const [profile, setProfile] = useState<Profile | undefined>(undefined);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!userId) { setProfile(undefined); return; }
    fetchProfile(userId).then(setProfile).catch(() => setProfile(undefined));
  }, [userId]);

  return {
    profile,
    isMenuOpen, setIsMenuOpen,
    isEditing, setIsEditing,
    isOwner: currentUser?.id === userId,
    displayName: profile ? formatName(profile) : undefined,
  };
}

// UserCard.tsx — only renders
export function UserCard({ userId }: { userId: string }) {
  const { isOwner, displayName, ... } = useUserCard(userId);
  // pure JSX
}
```

Place the hook **beside the component file** (same directory), not in `app/features/` or `lib/`, unless it is reused by more than one component.

> For when to use `app/features/` vs co-location, see `features-folder-boundary`.
