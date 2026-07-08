"use client";

import { useState } from "react";

export interface BusyKeys {
  /** Whether `key` currently has an in-flight request. */
  has: (key: string) => boolean;
  /** Marks `key` as busy. Returns false (and does nothing) if `key` is already busy — a re-entrancy guard against firing a second concurrent request for the same key before the first settles. */
  start: (key: string) => boolean;
  /** Marks `key` as no longer busy. Safe to call from a stale/late-resolving request — a functional update that only removes the exact key, so it never clobbers a newer request's busy state. */
  settle: (key: string) => void;
}

// Shared per-key "is this row/action currently in flight" tracker for
// action buttons that show a loading spinner (Retry, Disable/Enable,
// Regenerate secret, ...). Originally duplicated near-verbatim between
// webhooks-panel.tsx's busyKeys state and delivery-log-table.tsx's
// retryingIds state, and had already diverged — webhooks-panel.tsx added
// the start() re-entrancy guard, retryingIds lacked it. Consolidated here so
// both call sites share one implementation (and the guard) instead of two
// independently-maintained copies.
//
// Keys are caller-defined strings (e.g. `toggle:${endpointId}`,
// `regenerate:${endpointId}`, or a bare delivery id) rather than a single
// shared boolean/id, so concurrent actions on different rows — or two
// different actions on the same row — never clobber each other's loading
// indicator, whether at click time (start()) or when one settles before
// another (settle()).
export function useBusyKeys(): BusyKeys {
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());

  function has(key: string): boolean {
    return busyKeys.has(key);
  }

  function start(key: string): boolean {
    if (busyKeys.has(key)) {
      return false;
    }
    setBusyKeys((prev) => new Set(prev).add(key));
    return true;
  }

  function settle(key: string): void {
    setBusyKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  return { has, start, settle };
}
