import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildEnvFile, REQUIRED_ENV_VARS } from "./env-file";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const realTemplate = readFileSync(join(repoRoot, ".env.release.example"), "utf-8");

describe("buildEnvFile", () => {
  it("fills only the named vars, leaving comments and other lines untouched", () => {
    const template = [
      "# a comment explaining FOO",
      "FOO=",
      "# a comment explaining BAR",
      "BAR=default-value",
      "FIXED=untouched",
    ].join("\n");

    const result = buildEnvFile(template, { FOO: "generated", BAR: "chosen" });

    expect(result).toBe(
      [
        "# a comment explaining FOO",
        "FOO=generated",
        "# a comment explaining BAR",
        "BAR=chosen",
        "FIXED=untouched",
      ].join("\n"),
    );
  });

  it("throws if a requested var doesn't exist in the template (drift guard)", () => {
    expect(() => buildEnvFile("FOO=\n", { FOO: "x", MISSING: "y" })).toThrow(/MISSING/);
  });

  it("fills every REQUIRED_ENV_VARS entry non-empty against the real .env.release.example", () => {
    const values = Object.fromEntries(REQUIRED_ENV_VARS.map((name) => [name, `test-${name}`]));

    const result = buildEnvFile(realTemplate, values);

    for (const name of REQUIRED_ENV_VARS) {
      expect(result).toMatch(new RegExp(`^${name}=test-${name}$`, "m"));
    }
    // Comments and [FIXED VALUE]/[OPTIONAL] lines survive verbatim.
    expect(result).toContain("FIBER_NODE_URL=http://fiber-node:8227");
    expect(result).toContain("[REQUIRED] GitHub org/user the fibergate-core image was published under");
  });
});
