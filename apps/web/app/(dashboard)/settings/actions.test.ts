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
