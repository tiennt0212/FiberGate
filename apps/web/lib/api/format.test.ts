import { describe, expect, it } from "vitest";

import { shannonToCkb } from "./format";

describe("shannonToCkb", () => {
  it("converts zero", () => {
    expect(shannonToCkb(0n)).toBe(0);
  });

  it("converts exactly 1 CKB (10^8 shannon), trimming trailing zeros", () => {
    expect(shannonToCkb(100_000_000n)).toBe(1);
  });

  it("converts a fractional amount", () => {
    expect(shannonToCkb(150_000_000n)).toBe(1.5);
  });

  it("converts the smallest unit (1 shannon)", () => {
    expect(shannonToCkb(1n)).toBe(0.00000001);
  });

  it("converts a value larger than the invoice amount cap without precision loss", () => {
    // Larger than BR-INV-001's 1000 CKB invoice cap — this path matters for
    // GET /node/info's channel capacity aggregates, which aren't bounded the
    // same way.
    expect(shannonToCkb(123_456_789_123n)).toBe(1234.56789123);
  });
});
