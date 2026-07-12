import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { directoryIsEmptyOrMissing, writeScaffold } from "./scaffold";

describe("scaffold", () => {
  let workDir: string;
  let fakeTemplatesDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "create-fibergate-test-"));
    fakeTemplatesDir = join(workDir, "fake-templates");
    mkdirSync(join(fakeTemplatesDir, "docker", "fiber-node"), { recursive: true });
    mkdirSync(join(fakeTemplatesDir, "docker", "nginx"), { recursive: true });
    writeFileSync(join(fakeTemplatesDir, "docker-compose.release.yml"), "compose: fixture\n");
    writeFileSync(join(fakeTemplatesDir, "docker", "fiber-node", "config.yml"), "config: fixture\n");
    writeFileSync(
      join(fakeTemplatesDir, "docker", "nginx", "nginx.conf.template"),
      "nginx: fixture\n",
    );
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it("writes the full deploy directory structure with restrictive file permissions", () => {
    const targetDir = join(workDir, "deploy");

    writeScaffold({
      targetDir,
      envContent: "FOO=bar\n",
      ckbKeyBytes: Buffer.from("deadbeef"),
      templatesDir: fakeTemplatesDir,
    });

    expect(readFileSync(join(targetDir, "docker-compose.release.yml"), "utf-8")).toBe(
      "compose: fixture\n",
    );
    expect(readFileSync(join(targetDir, "docker", "fiber-node", "config.yml"), "utf-8")).toBe(
      "config: fixture\n",
    );
    expect(
      readFileSync(join(targetDir, "docker", "nginx", "nginx.conf.template"), "utf-8"),
    ).toBe("nginx: fixture\n");
    expect(readFileSync(join(targetDir, ".env"), "utf-8")).toBe("FOO=bar\n");
    expect(readFileSync(join(targetDir, "docker", "fiber-node", "ckb", "key"))).toEqual(
      Buffer.from("deadbeef"),
    );

    // 0o600 == owner read/write only
    expect(statSync(join(targetDir, ".env")).mode & 0o777).toBe(0o600);
    expect(
      statSync(join(targetDir, "docker", "fiber-node", "ckb", "key")).mode & 0o777,
    ).toBe(0o600);
  });

  describe("directoryIsEmptyOrMissing", () => {
    it("is true for a path that doesn't exist yet", () => {
      expect(directoryIsEmptyOrMissing(join(workDir, "does-not-exist"))).toBe(true);
    });

    it("is true for an existing empty directory", () => {
      const emptyDir = join(workDir, "empty");
      mkdirSync(emptyDir);
      expect(directoryIsEmptyOrMissing(emptyDir)).toBe(true);
    });

    it("is false for a directory with at least one entry", () => {
      writeFileSync(join(fakeTemplatesDir, "docker-compose.release.yml"), "x");
      expect(directoryIsEmptyOrMissing(fakeTemplatesDir)).toBe(false);
    });
  });
});
