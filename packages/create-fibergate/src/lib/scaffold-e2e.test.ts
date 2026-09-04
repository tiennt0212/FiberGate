import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { buildEnvFile, REQUIRED_ENV_VARS } from "./env-file";
import { writeScaffold } from "./scaffold";

// The two things scaffold.test.ts cannot check, because it runs against fixture
// templates: that the REAL config.yml still ships an empty announced_addrs, and
// that the generated deploy actually resolves under Compose. Everything else
// about the output tree — structure, permissions, .gitignore, the compose
// rename — is already asserted there and deliberately not repeated here.
//
// Everything except the interactive prompts is exercised: @clack/prompts needs a
// real TTY and cannot be driven from a pipe, so the wizard's questions stay a
// manual check (docs/maintainers/local-testing.md). What runs here is every line
// that turns those answers into files.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const templatesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "templates");

const DOMAIN = "shop.example.com";
const P2P_DOMAIN = "fiber.shop.example.com";

/**
 * Stand-ins for the wizard's answers — only the two under test carry meaning.
 * FIBER_P2P_DOMAIN defaults to "" rather than a placeholder, because blank is
 * what the wizard actually writes for a merchant with no CDN, and a placeholder
 * there would silently turn every case into the CDN case.
 */
function answers(overrides: Record<string, string> = {}): Record<string, string> {
  return Object.fromEntries(
    REQUIRED_ENV_VARS.map((name) => [
      name,
      overrides[name] ?? (name === "FIBER_P2P_DOMAIN" ? "" : `test-${name}`),
    ]),
  );
}

function scaffoldInto(overrides: Record<string, string> = {}): string {
  const targetDir = mkdtempSync(join(tmpdir(), "fibergate-scaffold-"));
  const template = readFileSync(join(repoRoot, ".env.release.example"), "utf-8");
  writeScaffold({
    targetDir,
    envContent: buildEnvFile(template, answers({ DOMAIN, ...overrides })),
    ckbKeyBytes: Buffer.from("a".repeat(64), "utf-8"),
    templatesDir,
  });
  return targetDir;
}

const created: string[] = [];
afterAll(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

describe("scaffolded deploy directory (real templates)", () => {
  it("leaves announced_addrs empty in config.yml — the value must come from the env var", () => {
    const dir = scaffoldInto();
    created.push(dir);

    const config = readFileSync(join(dir, "docker", "fiber-node", "config.yml"), "utf-8");
    // Filling this in looks like the obvious fix for "the node announces
    // nothing" and would ship a single hardcoded address to every merchant
    // using this template. See gotchas.md.
    expect(config).toMatch(/^\s*announced_addrs:\s*$/m);
    expect(config).not.toMatch(/^\s*-\s*"\/dns4\//m);
  });
});

// Compose itself is the only thing that can confirm the generated file resolves
// the way the merchant will experience it — reimplementing its interpolation
// here would just test our own copy of the rules.
describe("generated compose resolves the announced address", () => {
  const dockerAvailable = (() => {
    try {
      execFileSync("docker", ["version", "--format", "{{.Server.Version}}"], { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  })();

  const announcedAddrs = (dir: string): string => {
    const out = execFileSync("docker", ["compose", "-f", join(dir, "docker-compose.yml"), "config"], {
      cwd: dir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return out.match(/FIBER_ANNOUNCED_ADDRS:\s*(.*)/)?.[1]?.trim() ?? "";
  };

  it.runIf(dockerAvailable)("announces DOMAIN when no CDN is involved", () => {
    const dir = scaffoldInto();
    created.push(dir);

    expect(announcedAddrs(dir)).toBe(`/dns4/${DOMAIN}/tcp/8228,/dns4/${DOMAIN}/tcp/8228/wss`);
  });

  it.runIf(dockerAvailable)("announces FIBER_P2P_DOMAIN instead when one is set", () => {
    const dir = scaffoldInto({ FIBER_P2P_DOMAIN: P2P_DOMAIN });
    created.push(dir);

    expect(announcedAddrs(dir)).toBe(`/dns4/${P2P_DOMAIN}/tcp/8228,/dns4/${P2P_DOMAIN}/tcp/8228/wss`);
  });
});
