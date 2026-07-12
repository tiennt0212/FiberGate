import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryChain } from "@/lib/db/test-fixtures";

// Mock at the module boundary, same convention as webhooks.test.ts.
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

const { db } = await import("@/lib/db");
const { getAdminPasswordHash, setAdminPassword } = await import("./settings");

afterEach(() => {
  vi.clearAllMocks();
});

describe("getAdminPasswordHash", () => {
  it("returns the settings row's value when one exists, ignoring the env var", () => {
    vi.mocked(db.select).mockReturnValue(
      createQueryChain([{ key: "admin_password_hash", value: "$2b$10$db-stored-hash", updatedAt: new Date() }]) as unknown as ReturnType<
        typeof db.select
      >,
    );

    return expect(getAdminPasswordHash()).resolves.toBe("$2b$10$db-stored-hash");
  });

  describe("when no settings row exists (env fallback)", () => {
    beforeEach(() => {
      // base64("$2b$10$env-seeded-hash")
      process.env.ADMIN_PASSWORD_HASH_B64 = Buffer.from("$2b$10$env-seeded-hash", "utf-8").toString("base64");
    });

    afterEach(() => {
      delete process.env.ADMIN_PASSWORD_HASH_B64;
    });

    it("decodes and returns ADMIN_PASSWORD_HASH_B64", async () => {
      vi.mocked(db.select).mockReturnValue(createQueryChain([]) as unknown as ReturnType<typeof db.select>);

      await expect(getAdminPasswordHash()).resolves.toBe("$2b$10$env-seeded-hash");
    });
  });

  it("throws if there's no settings row and ADMIN_PASSWORD_HASH_B64 is unset", async () => {
    delete process.env.ADMIN_PASSWORD_HASH_B64;
    vi.mocked(db.select).mockReturnValue(createQueryChain([]) as unknown as ReturnType<typeof db.select>);

    await expect(getAdminPasswordHash()).rejects.toThrow("Missing required env var: ADMIN_PASSWORD_HASH_B64");
  });
});

describe("setAdminPassword", () => {
  it("upserts a bcrypt hash of the new password under the admin_password_hash key", async () => {
    const insertChain = createQueryChain([{ key: "admin_password_hash" }]);
    vi.mocked(db.insert).mockReturnValue(insertChain as unknown as ReturnType<typeof db.insert>);

    await setAdminPassword("a-new-strong-password");

    expect(db.insert).toHaveBeenCalled();
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ key: "admin_password_hash", value: expect.stringMatching(/^\$2[aby]\$10\$/) }),
    );
    expect(insertChain.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.anything(),
        set: expect.objectContaining({ value: expect.stringMatching(/^\$2[aby]\$10\$/) }),
      }),
    );
  });
});
