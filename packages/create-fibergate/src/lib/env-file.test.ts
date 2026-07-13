import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildEnvFile, LOCAL_REQUIRED_ENV_VARS, REQUIRED_ENV_VARS } from "./env-file";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const realTemplate = readFileSync(join(repoRoot, ".env.release.example"), "utf-8");
const realLocalTemplate = readFileSync(join(repoRoot, ".env.example"), "utf-8");

// One case per (.env template variant, its *_REQUIRED_ENV_VARS list) pair —
// see the 2 describe.each blocks below.
const templateCases = [
  {
    label: ".env.release.example",
    template: realTemplate,
    requiredVars: REQUIRED_ENV_VARS as readonly string[],
    extraLine: "[REQUIRED] GitHub org/user the fibergate-core image was published under",
  },
  {
    label: ".env.example",
    template: realLocalTemplate,
    requiredVars: LOCAL_REQUIRED_ENV_VARS as readonly string[],
    extraLine: "FIBER_PAYER_SECRET_KEY_PASSWORD=",
  },
];

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

  it("throws if the template marks a var [REQUIRED] with no value supplied (reverse drift guard)", () => {
    const template = ["# [REQUIRED] needs a value", "NEEDS_VALUE=", "OPTIONAL_VAR="].join("\n");

    expect(() => buildEnvFile(template, {})).toThrow(/NEEDS_VALUE/);
  });

  it("still catches a [REQUIRED] var even with a blank line before its VAR= line", () => {
    const template = ["# [REQUIRED] needs a value", "", "NEEDS_VALUE="].join("\n");

    expect(() => buildEnvFile(template, {})).toThrow(/NEEDS_VALUE/);
  });

  it("doesn't require a value for vars without a [REQUIRED] marker", () => {
    const template = [
      "# [OPTIONAL] fine to leave blank",
      "OPTIONAL_VAR=",
      "# [FIXED VALUE] don't touch",
      "FIXED_VAR=some-default",
    ].join("\n");

    expect(() => buildEnvFile(template, {})).not.toThrow();
  });

  describe.each(templateCases)("against the real $label", ({ template, requiredVars, extraLine }) => {
    it("every [REQUIRED] var is covered by the matching *_REQUIRED_ENV_VARS list", () => {
      // Not every entry in that list is marked [REQUIRED] in the template
      // (POSTGRES_USER/POSTGRES_DB already have working defaults, but the
      // wizard still collects/confirms a value for them) — so this checks
      // the subset direction that actually matters: nothing the template
      // marks [REQUIRED] is missing from what the wizard supplies.
      let thrown: Error | undefined;
      try {
        buildEnvFile(template, {});
      } catch (err) {
        thrown = err as Error;
      }

      expect(thrown).toBeDefined();
      const missing = thrown!.message.match(/\[REQUIRED\] with no value supplied: (.+)$/)?.[1];
      for (const name of missing?.split(", ") ?? []) {
        expect(requiredVars).toContain(name);
      }
    });

    it("fills every entry non-empty", () => {
      const values = Object.fromEntries(requiredVars.map((name) => [name, `test-${name}`]));

      const result = buildEnvFile(template, values);

      for (const name of requiredVars) {
        expect(result).toMatch(new RegExp(`^${name}=test-${name}$`, "m"));
      }
      // Comments, [FIXED VALUE]/[OPTIONAL] lines, and non-required vars
      // survive verbatim.
      expect(result).toContain("FIBER_NODE_URL=http://fiber-node:8227");
      expect(result).toContain(extraLine);
    });
  });
});
