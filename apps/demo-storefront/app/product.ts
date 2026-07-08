// The one mock product this storefront sells — BR-INV-001 allows 0.1–1000
// CKB, 2.5 CKB is comfortably inside that range. Kept out of actions.ts:
// a "use server" file may only export async functions, not plain data.
export const DEMO_PRODUCT = {
  name: "Fiber Network 101 — digital course",
  description: "A short course on building payment apps on Fiber Network.",
  amountCkb: 2.5,
} as const;
