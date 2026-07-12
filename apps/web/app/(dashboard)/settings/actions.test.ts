import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock at the service-layer boundary (CLAUDE.md's route.test.ts pattern —
// actions.ts is a thin controller), not @/lib/db directly. Never mock
// bcryptjs — exercising the real current-password check is the point.
vi.mock("@/lib/services/settings", () => ({
  getAdminPasswordHash: vi.fn(),
  setAdminPassword: vi.fn(),
}));

const { getAdminPasswordHash, setAdminPassword } = await import("@/lib/services/settings");
const { changePassword } = await import("./actions");

const CURRENT_PASSWORD = "correct-horse-battery-staple";
const CURRENT_HASH = bcrypt.hashSync(CURRENT_PASSWORD, 10);

afterEach(() => {
  vi.clearAllMocks();
});

describe("changePassword", () => {
  it("rejects a new password shorter than 8 characters without checking the current one", async () => {
    const result = await changePassword(CURRENT_PASSWORD, "short");

    expect(result).toEqual({ ok: false, error: "New password must be at least 8 characters." });
    expect(getAdminPasswordHash).not.toHaveBeenCalled();
    expect(setAdminPassword).not.toHaveBeenCalled();
  });

  it("rejects a new password longer than 72 bytes without checking the current one (bcrypt silently truncates past that)", async () => {
    const result = await changePassword(CURRENT_PASSWORD, "a".repeat(73));

    expect(result).toEqual({ ok: false, error: "New password must be at most 72 bytes long." });
    expect(getAdminPasswordHash).not.toHaveBeenCalled();
    expect(setAdminPassword).not.toHaveBeenCalled();
  });

  it("measures the max length in bytes, not characters, so multi-byte UTF-8 input is rejected earlier than 72 chars", async () => {
    // "é" is 2 bytes in UTF-8 — 40 of them is 80 bytes, well past the limit,
    // even though .length (UTF-16 code units) would read as only 40.
    const result = await changePassword(CURRENT_PASSWORD, "é".repeat(40));

    expect(result).toEqual({ ok: false, error: "New password must be at most 72 bytes long." });
    expect(getAdminPasswordHash).not.toHaveBeenCalled();
  });

  it("accepts a new password exactly at the 72-byte boundary", async () => {
    vi.mocked(getAdminPasswordHash).mockResolvedValue(CURRENT_HASH);

    const result = await changePassword(CURRENT_PASSWORD, "a".repeat(72));

    expect(result).toEqual({ ok: true });
    expect(setAdminPassword).toHaveBeenCalledWith("a".repeat(72));
  });

  it("rejects when the current password is wrong", async () => {
    vi.mocked(getAdminPasswordHash).mockResolvedValue(CURRENT_HASH);

    const result = await changePassword("wrong-password", "a-new-strong-password");

    expect(result).toEqual({ ok: false, error: "Current password is incorrect." });
    expect(setAdminPassword).not.toHaveBeenCalled();
  });

  it("updates the password when the current password is correct", async () => {
    vi.mocked(getAdminPasswordHash).mockResolvedValue(CURRENT_HASH);

    const result = await changePassword(CURRENT_PASSWORD, "a-new-strong-password");

    expect(result).toEqual({ ok: true });
    expect(setAdminPassword).toHaveBeenCalledWith("a-new-strong-password");
  });

  it("returns a generic error and does not throw if the service call fails", async () => {
    vi.mocked(getAdminPasswordHash).mockRejectedValue(new Error("db unreachable"));

    const result = await changePassword(CURRENT_PASSWORD, "a-new-strong-password");

    expect(result).toEqual({ ok: false, error: "Could not change the password." });
  });
});
