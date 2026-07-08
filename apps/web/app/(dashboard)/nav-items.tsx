import type { ReactNode } from "react";

import { ROUTE } from "@/lib/auth/routes";

// Single source of truth for sidebar nav items + header page titles
// (frontend-exp's routing-single-source-of-truth) — Sidebar, Header, and
// their route highlighting all read from here instead of duplicating route
// strings/labels. Icon markup is copied verbatim from
// .context/design/FiberGate.dc.html (same viewBox/paths) rather than adding
// an icon library dependency CLAUDE.md would require asking about first.

function OverviewIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="8.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="8.5" width="5" height="5" rx="1" />
      <rect x="8.5" y="8.5" width="5" height="5" rx="1" />
    </svg>
  );
}

function InvoicesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="1.5" width="11" height="12" rx="1.5" />
      <line x1="5" y1="5" x2="10" y2="5" />
      <line x1="5" y1="7.8" x2="10" y2="7.8" />
      <line x1="5" y1="10.5" x2="8" y2="10.5" />
    </svg>
  );
}

function DeliveryLogIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4.5h11M2 7.8h7M2 11h5" />
      <circle cx="12.5" cy="11" r="2" />
      <path d="M11.8 11l.4.4L13.5 9.8" />
    </svg>
  );
}

function WebhooksIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L3.5 8H8L6 13.5L13.5 6H9.5z" />
    </svg>
  );
}

function QuickStartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 1.5C7.5 1.5 11.5 3.5 11.5 7.5L9 10H6L3.5 7.5C3.5 3.5 7 1.5 7.5 1.5z" />
      <circle cx="7.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <path d="M5.5 10.5L4.5 13.5M9.5 10.5L10.5 13.5" />
    </svg>
  );
}

export interface DashboardNavItem {
  key: string;
  route: (typeof ROUTE)[keyof typeof ROUTE];
  label: string;
  icon: ReactNode;
}

export const MAIN_NAV_ITEMS: DashboardNavItem[] = [
  { key: "overview", route: ROUTE.DASHBOARD, label: "Overview", icon: <OverviewIcon /> },
  { key: "invoices", route: ROUTE.INVOICES, label: "Invoices", icon: <InvoicesIcon /> },
  { key: "delivery-log", route: ROUTE.DELIVERY_LOG, label: "Delivery Log", icon: <DeliveryLogIcon /> },
  { key: "webhooks", route: ROUTE.WEBHOOKS, label: "Webhooks", icon: <WebhooksIcon /> },
];

export const SETUP_NAV_ITEMS: DashboardNavItem[] = [
  { key: "quick-start", route: ROUTE.QUICK_START, label: "Quick Start", icon: <QuickStartIcon /> },
];

export const ALL_NAV_ITEMS: DashboardNavItem[] = [...MAIN_NAV_ITEMS, ...SETUP_NAV_ITEMS];

/** Header page title per route — DESIGN.md "page-title" type scale. */
export const PAGE_TITLES: Record<string, string> = {
  [ROUTE.DASHBOARD]: "Overview",
  [ROUTE.INVOICES]: "Invoices",
  [ROUTE.DELIVERY_LOG]: "Delivery Log",
  [ROUTE.WEBHOOKS]: "Webhooks",
  [ROUTE.QUICK_START]: "Quick Start",
};
