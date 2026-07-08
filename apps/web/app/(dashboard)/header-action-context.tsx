"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

// Bridges the shared Header's contextual CTA button (rendered once, in
// layout.tsx's chrome) to whichever page currently owns that action's real
// behavior — "Export CSV" needs the Invoices/Delivery Log page's current
// filtered rows, "Add Endpoint" needs the Webhooks page's drawer state.
// Next.js App Router layouts and pages are separate component trees with no
// direct prop path between them, so a page registers its action via
// useHeaderAction() in an effect; Header (header.tsx) reads it back out.
// Deliberately NOT a "global state" store (frontend-exp's
// state-singleton-stores is about app-wide state read by many components) —
// this Context has exactly one reader (Header) and one writer at a time (the
// currently-mounted page), which is the standard React pattern for this kind
// of layout/page action bridge.

export interface HeaderAction {
  label: string;
  onClick: () => void;
  loading?: boolean;
}

interface HeaderActionContextValue {
  action: HeaderAction | null;
  setAction: (action: HeaderAction | null) => void;
}

const HeaderActionContext = createContext<HeaderActionContextValue | null>(null);

export function HeaderActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<HeaderAction | null>(null);
  const value = useMemo(() => ({ action, setAction }), [action]);
  return <HeaderActionContext.Provider value={value}>{children}</HeaderActionContext.Provider>;
}

/**
 * Read by Header (header.tsx) to render the current CTA, and by pages to
 * register one. A page registers its action via:
 *
 *   const { setAction } = useHeaderActionContext();
 *   useEffect(() => {
 *     setAction({ label: "Export CSV", onClick: handleExport });
 *     return () => setAction(null);
 *   }, [setAction, handleExport]);
 *
 * Pages with no CTA (Overview) simply never call setAction.
 */
export function useHeaderActionContext(): HeaderActionContextValue {
  const ctx = useContext(HeaderActionContext);
  if (!ctx) {
    throw new Error("useHeaderActionContext must be used within a HeaderActionProvider");
  }
  return ctx;
}
