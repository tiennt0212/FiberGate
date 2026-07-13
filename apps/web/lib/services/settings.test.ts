import { DrizzleQueryError } from "drizzle-orm";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryChain, createRejectingQueryChain } from "@/lib/db/test-fixtures";

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

  describe("when the settings table doesn't exist yet (unmigrated DB)", () => {
    beforeEach(() => {
      process.env.ADMIN_PASSWORD_HASH_B64 = Buffer.from("$2b$10$env-seeded-hash", "utf-8").toString("base64");
    });

    afterEach(() => {
      delete process.env.ADMIN_PASSWORD_HASH_B64;
    });

    // Real shape reproduced against a schema-less Postgres, not guessed:
    // querying a table that doesn't exist throws a DrizzleQueryError whose
    // .cause is a postgres.PostgresError with SQLSTATE 42P01
    // ("undefined_table").
    function undefinedTableError() {
      // postgres.PostgresError's real constructor (Object.assign(this, x))
      // accepts a full options object at runtime, but its .d.ts only types
      // a string message — construct via the typed signature, then assign
      // `code` after, to match the real shape without an `as any` escape.
      const cause = Object.assign(new postgres.PostgresError('relation "settings" does not exist'), {
        code: "42P01",
      });
      return new DrizzleQueryError("select ...", [], cause);
    }

    it("falls back to ADMIN_PASSWORD_HASH_B64 instead of throwing", async () => {
      vi.mocked(db.select).mockReturnValue(
        createRejectingQueryChain(undefinedTableError()) as unknown as ReturnType<typeof db.select>,
      );

      await expect(getAdminPasswordHash()).resolves.toBe("$2b$10$env-seeded-hash");
    });

    it("still throws for any other DB error (e.g. connection failure)", async () => {
      const connectionError = new DrizzleQueryError("select ...", [], new Error("connection refused"));
      vi.mocked(db.select).mockReturnValue(
        createRejectingQueryChain(connectionError) as unknown as ReturnType<typeof db.select>,
      );

      await expect(getAdminPasswordHash()).rejects.toThrow(connectionError);
    });
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
