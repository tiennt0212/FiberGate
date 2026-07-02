export const ROUTES = {
  DASHBOARD: "/dashboard",
  WEBHOOKS: "/webhooks",
  TRANSACTIONS: "/transactions",
  QUICK_START: "/quick-start",
  LOGIN: "/login",
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];

export const PAGE_TITLES: Record<Route, { group: string; title: string }> = {
  [ROUTES.DASHBOARD]: { group: "Main", title: "Overview" },
  [ROUTES.WEBHOOKS]: { group: "Main", title: "Webhooks" },
  [ROUTES.TRANSACTIONS]: { group: "Main", title: "Transactions" },
  [ROUTES.QUICK_START]: { group: "Setup", title: "Quick Start" },
  [ROUTES.LOGIN]: { group: "Auth", title: "Login" },
};
