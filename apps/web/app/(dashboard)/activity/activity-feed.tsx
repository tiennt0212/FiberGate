"use client";

import { useEffect, useRef, useState } from "react";

import type { ActivityLogEntry } from "@/lib/activity-log";

import { formatTimeWithSeconds } from "../format-date";

import { fetchRecentActivity } from "./actions";

const POLL_INTERVAL_MS = 3000;
const POLL_INTERVAL_SECONDS = POLL_INTERVAL_MS / 1000;

// Restyled to match .context/design/FiberGate.dc.html's Activity screen
// (issue #40 — the page originally shipped with no mockup at all, see the
// comment this replaced). Row grid/colors/countdown pill below all come from
// that file's ACTIVITY section + its SOURCE_CFG (poller=accent,
// webhook=purple) — every color used here already has a DESIGN.md token
// (status-danger-bg/text for the error row/badge, accent/purple for the
// source dot), nothing new introduced.

const SOURCE_DOT_CLASS: Record<string, string> = {
  poller: "bg-accent",
  webhook: "bg-purple",
};

function signatureOf(entries: ActivityLogEntry[]): string {
  return `${entries.length}:${entries.at(-1)?.id ?? ""}`;
}

export function ActivityFeed({ initialEntries }: { initialEntries: ActivityLogEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [secondsUntilNextPoll, setSecondsUntilNextPoll] = useState(POLL_INTERVAL_SECONDS);
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

  // Cosmetic countdown only (started in the same effect tick as the poll
  // interval above, so it stays visually in sync) — the real poll cadence is
  // POLL_INTERVAL_MS regardless of what this displays.
  useEffect(() => {
    const tickId = setInterval(() => {
      if (document.hidden) {
        return; // matches the poll effect above — no point re-rendering a backgrounded tab every second
      }
      setSecondsUntilNextPoll((prev) => (prev <= 1 ? POLL_INTERVAL_SECONDS : prev - 1));
    }, 1000);

    return () => clearInterval(tickId);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="animate-[fade-in_0.2s_ease-out_forwards]">
      <div className="mb-4.5 flex items-center justify-between">
        <div className="text-[12.5px] text-text-subtle">Real-time log of poller + webhook delivery activity in fibergate-core</div>
        <div className="flex items-center gap-1.75 rounded-md border border-status-online-border bg-status-online-bg px-2.75 py-1.25 text-[12px] text-status-success-text">
          <div className="h-1.75 w-1.75 shrink-0 rounded-full bg-success [animation:pulse-dot_2s_ease-in-out_infinite]" />
          Live · next poll in {secondsUntilNextPoll}s
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <div className="grid grid-cols-[76px_76px_1fr] bg-table-header-bg px-5 py-2.25 text-[11.5px] font-semibold uppercase tracking-wider text-text-xsubtle">
          <span>Time</span>
          <span>Source</span>
          <span>Message</span>
        </div>
        <div ref={scrollRef} onScroll={(event) => {
          const el = event.currentTarget;
          wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }} className="max-h-[70vh] overflow-y-auto">
          {entries.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-text-subtle">No activity yet.</div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className={`grid grid-cols-[76px_76px_1fr] items-start border-b border-border-subtle px-5 py-2.25 last:border-b-0 ${
                  entry.level === "error" ? "bg-status-offline-bg" : "bg-white"
                }`}
              >
                <span className="whitespace-nowrap pt-px font-mono text-[12px] text-text-subtle">
                  {formatTimeWithSeconds(entry.timestamp)}
                </span>
                <span className="flex items-center gap-1.5 pt-px">
                  <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${SOURCE_DOT_CLASS[entry.source] ?? "bg-text-subtle"}`} />
                  <span className="font-mono text-[11.5px] text-text-secondary">{entry.source}</span>
                </span>
                <span
                  className={`flex items-center gap-2 text-[13px] leading-relaxed ${
                    entry.level === "error" ? "text-status-danger-text" : "text-text-strong"
                  }`}
                >
                  {entry.message}
                  {entry.level === "error" ? (
                    <span className="shrink-0 rounded-full bg-status-danger-bg px-1.75 py-0.25 text-[10.5px] font-semibold text-status-danger-text">
                      ERROR
                    </span>
                  ) : null}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
