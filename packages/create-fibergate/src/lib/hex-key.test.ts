import { describe, expect, it } from "vitest";
import { InvalidHexKeyError, parseHexKeyFile } from "./hex-key";

describe("parseHexKeyFile", () => {
  it("accepts 64 raw hex characters and appends a trailing newline", () => {
    const raw = "a".repeat(64);
    expect(parseHexKeyFile(raw)).toEqual(Buffer.from(`${raw}\n`, "utf-8"));
  });

  it("trims surrounding whitespace before validating", () => {
    const raw = "b".repeat(64);
    expect(parseHexKeyFile(`  ${raw}\n`)).toEqual(Buffer.from(`${raw}\n`, "utf-8"));
  });

  it("rejects a 0x-prefixed key", () => {
    expect(() => parseHexKeyFile(`0x${"a".repeat(64)}`)).toThrow(InvalidHexKeyError);
  });

  it("rejects a key that's the wrong length", () => {
    expect(() => parseHexKeyFile("a".repeat(63))).toThrow(InvalidHexKeyError);
  });

  it("rejects non-hex characters", () => {
    expect(() => parseHexKeyFile("z".repeat(64))).toThrow(InvalidHexKeyError);
  });
});
