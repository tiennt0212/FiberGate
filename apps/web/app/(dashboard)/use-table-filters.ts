"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// Shared URL-driven filter/pagination/debounced-search plumbing for the
// Invoices and Delivery Log tables (issue #10 WARN pass). Both tables
// previously copy-pasted an identical buildHref/updateFilters/goToPage
// URLSearchParams pattern and an identical 400ms debounced-search effect —
// consolidated here so a future fix to this pattern only needs to happen
// once. Kept out of search-params.ts (unlike the pure parseDateStart/
// parseDateEnd/downloadCsv/csvEscape helpers) because it needs
// next/navigation's router/pathname hooks and therefore must live in a
// "use client" module — search-params.ts is also imported by Server
// Component pages (e.g. invoices/page.tsx) for `firstParam`, and a "use
// client" directive there would make those plain-function imports invalid
// from a Server Component.
export function useTableFilters<F extends Record<keyof F, string>>({
  filters,
  defaults,
  searchKey,
}: {
  /** Current filter values, e.g. `{ status: "all", q: "", ... }`. */
  filters: F;
  /** The "no filter" value per key — omitted from the URL when a field equals it (e.g. "all" for enum fields, "" for free text/date fields). */
  defaults: Record<keyof F, string>;
  /** Key of the free-text field that debounces navigation by 400ms instead of navigating on every keystroke. */
  searchKey?: keyof F;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchFilterValue = searchKey ? filters[searchKey] : "";
  const [searchInput, setSearchInput] = useState(searchFilterValue);

  useEffect(() => {
    setSearchInput(searchFilterValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFilterValue]);

  useEffect(() => {
    if (!searchKey || searchInput === filters[searchKey]) {
      return;
    }
    const handle = setTimeout(() => updateFilters({ [searchKey]: searchInput } as Partial<F>), 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function buildHref(overrides: Partial<F>, targetPage: number): string {
    const merged: F = { ...filters, ...overrides };
    const params = new URLSearchParams();
    for (const key of Object.keys(filters) as (keyof F)[]) {
      const value = merged[key];
      if (value && value !== defaults[key]) {
        params.set(String(key), value);
      }
    }
    if (targetPage > 0) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function updateFilters(overrides: Partial<F>): void {
    router.replace(buildHref(overrides, 0));
  }

  function goToPage(nextPage: number): void {
    router.replace(buildHref({}, nextPage));
  }

  function clearFilters(): void {
    updateFilters(defaults as unknown as Partial<F>);
  }

  const hasActiveFilters = (Object.keys(filters) as (keyof F)[]).some((key) => filters[key] !== defaults[key]);

  return { searchInput, setSearchInput, updateFilters, goToPage, clearFilters, hasActiveFilters };
}
