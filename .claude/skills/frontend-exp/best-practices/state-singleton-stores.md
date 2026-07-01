---
title: Prefer singleton stores over React Context for global state
impact: HIGH
tags: state, zustand, context, stores
---

## Prefer singleton stores over React Context for global state

**Impact: HIGH**

Use a module-level singleton store (Zustand, Jotai, Nanostores) for global client state instead of React Context + Provider. Keep React Context only for tree-scoped side effects (e.g. a `ThemeContext` that writes CSS classes to `document.documentElement`).

React Context requires wrapping the tree in a `<Provider>` — every new global state piece touches the root providers file. Singleton stores are module-level and usable anywhere without wrappers, including Storybook decorators and tests.

**Incorrect (React Context adds provider boilerplate and can't be directly initialized in stories):**

```tsx
// contexts/NetworkContext.tsx
export function NetworkProvider({ children }) {
  const [network, setNetwork] = useState(readEnvNetwork());
  return (
    <NetworkContext.Provider value={{ network, setNetwork }}>
      {children}
    </NetworkContext.Provider>
  );
}

// providers.tsx — every new global state needs a new wrapper here
<ThemeProvider>
  <NetworkProvider>
    <SomeOtherProvider>{children}</SomeOtherProvider>
  </NetworkProvider>
</ThemeProvider>
```

**Correct (Zustand store — no provider, works in stories and tests without wrapping):**

```tsx
// stores/network.ts
"use client";
import { create } from "zustand";

export const useNetworkStore = create<NetworkState>((set) => ({
  network: readEnvNetwork(),
  setNetwork: (network) => set({ network }),
}));

// In a Storybook decorator — direct state init, no provider needed
decorators: [
  (Story, ctx) => {
    useNetworkStore.setState({ network: ctx.args.network ?? "testnet" });
    return <Story />;
  },
],
```

When to keep React Context: use it only for side effects tied to the React tree lifecycle (e.g. writing to `document.documentElement`, subscribing to DOM events on mount/unmount). Everything else belongs in a store.

Recommended libraries: [Zustand](https://zustand.docs.pmnd.rs/) (simple, no boilerplate), [Jotai](https://jotai.org/) (atomic), [Nanostores](https://github.com/nanostores/nanostores) (framework-agnostic).
