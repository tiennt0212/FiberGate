"use client";

import { useEffect, useRef, useState } from "react";

import type { ActivityLogEntry } from "@/lib/activity-log";

import { formatTimeWithSeconds } from "../format-date";

import { fetchRecentActivity } from "./actions";

const POLL_INTERVAL_MS = 3000;

// Terminal-style feed, same "Code Block" primitive as quick-start-steps.tsx
// (bg-code-bg / font-mono / text-[#e2e8f0]) — no pre-existing mockup for a
// log feed exists in .context/design, so this composes the closest matching
// design-token primitive rather than inventing new colors/spacing.

const LEVEL_CLASS: Record<ActivityLogEntry["level"], string> = {
  info: "text-[#e2e8f0]",
  error: "text-danger",
};

// Cheap enough to tell "nothing new happened" without a deep comparison: the
// buffer only ever grows or FIFO-rotates, so (length, newest id) is identical
// across polls iff the entries are identical.
function signatureOf(entries: ActivityLogEntry[]): string {
  return `${entries.length}:${entries.at(-1)?.id ?? ""}`;
}

export function ActivityFeed({ initialEntries }: { initialEntries: ActivityLogEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  const lastSignatureRef = useRef(signatureOf(initialEntries));

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (document.hidden) {
        return;
      }
      fetchRecentActivity()
        .then((fetched) => {
          const signature = signatureOf(fetched);
          if (signature === lastSignatureRef.current) {
            return; // no new activity — skip the state update and its re-render
          }
          lastSignatureRef.current = signature;
          setEntries(fetched);
        })
        .catch((error: unknown) => {
          console.error("Activity: failed to poll recent activity:", error);
        });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="animate-[fade-in_0.2s_ease-out_forwards]">
      <div className="mb-3.5 text-[13px] text-text-muted">
        Live feed of poller and webhook delivery activity in this fibergate-core process. Updates every{" "}
        {POLL_INTERVAL_MS / 1000}s.
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <div
          ref={scrollRef}
          onScroll={(event) => {
            const el = event.currentTarget;
            wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          }}
          className="max-h-[70vh] overflow-y-auto bg-code-bg px-4 py-3 font-mono text-[12px] leading-relaxed"
        >
          {entries.length === 0 ? (
            <div className="text-[#e2e8f0]">No activity yet.</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className={LEVEL_CLASS[entry.level]}>
                <span className="text-[#64748b]">{formatTimeWithSeconds(entry.timestamp)}</span>{" "}
                <span className="text-[#64748b]">[{entry.source}]</span> {entry.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
