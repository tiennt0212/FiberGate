import { describe, expect, it } from "vitest";
import { validateSecretChars } from "./validate-secret";

describe("validateSecretChars", () => {
  it("accepts a plain alphanumeric value", () => {
    expect(validateSecretChars("correct-horse-battery-staple-123")).toBeUndefined();
  });

  it("rejects an empty/undefined value", () => {
    expect(validateSecretChars(undefined)).toBe("Required.");
    expect(validateSecretChars("")).toBe("Required.");
  });

  it.each(["has$dollar", "has\nnewline", "has@at", "has:colon", "has/slash"])(
    "rejects a value containing %s",
    (value) => {
      expect(validateSecretChars(value)).toMatch(/Avoid/);
    },
  );
});
