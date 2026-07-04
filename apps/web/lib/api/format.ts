// Ported (bigint-input path only) from @ckb-ccc/core's fixedPointToString,
// version 0.0.0-canary-20260505020844 (src/fixedPoint/index.ts, MIT
// license). Not imported directly: @ckb-ccc/fiber has never had a stable
// npm release (only canary snapshots exist) and its own package.json pins
// this exact @ckb-ccc/core canary as an internal dependency — adding
// @ckb-ccc/core as a second, independently-versioned dependency here would
// either duplicate the package at a different version than what
// @ckb-ccc/fiber actually uses internally, or force re-pinning to that same
// canary purely for one small utility. Vendoring the algorithm avoids both.
//
// Only the bigint path is ported since shannon is always a bigint here —
// the original also accepts string/number input via a separate
// fixedPointFrom() helper, not needed and not ported.

const SHANNON_DECIMALS = 8; // 1 CKB = 10^8 shannon

function shannonToCkbString(shannon: bigint): string {
  const str = shannon.toString();
  const l = str.length <= SHANNON_DECIMALS ? "0" : str.slice(0, -SHANNON_DECIMALS);
  const r = str
    .slice(-SHANNON_DECIMALS)
    .padStart(SHANNON_DECIMALS, "0")
    .replace(/0*$/, "");
  return r === "" ? l : `${l}.${r}`;
}

// Builds the decimal string via bigint/string manipulation only, never
// truncating the bigint through Number first — safer than a hand-rolled
// Number(shannon) / 1e8 division for values near Number.MAX_SAFE_INTEGER.
// The final string->Number step is still needed to match this API's
// existing JSON-number contract for amount/capacity fields.
export function shannonToCkb(shannon: bigint): number {
  return Number(shannonToCkbString(shannon));
}
