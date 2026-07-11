import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryChain } from "@/lib/db/test-fixtures";
import { ROUTE } from "@/lib/auth/routes";

// Mock at the module boundary this action calls out to (@/lib/auth/session,
// @/lib/db), same convention as app/api/v1/**'s route.test.ts mocking
// @/lib/db and @/lib/fiber/client — never mock bcryptjs/jose themselves, the
// whole point is exercising the real password-check logic (BR-SEC-002).
// @/lib/db's select() returns no row, so getAdminPasswordHash() (issue #30)
// falls through to the ADMIN_PASSWORD_HASH_B64 env-fallback path these tests
// exercise — the DB-backed path is covered separately by settings.test.ts.
vi.mock("@/lib/auth/session", () => ({
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(() => createQueryChain([])) },
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const { setSessionCookie, clearSessionCookie } = await import("@/lib/auth/session");
const { redirect } = await import("next/navigation");
const { login, logout } = await import("./actions");

const REAL_PASSWORD = "correct-horse-battery-staple";
const TEST_HASH = bcrypt.hashSync(REAL_PASSWORD, 10);
const TEST_HASH_BASE64 = Buffer.from(TEST_HASH, "utf-8").toString("base64");

function formDataWithPassword(password?: string): FormData {
  const formData = new FormData();
  if (password !== undefined) {
    formData.set("password", password);
  }
  return formData;
}

describe("login", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD_HASH_B64 = TEST_HASH_BASE64;
  });

  afterEach(() => {
    delete process.env.ADMIN_PASSWORD_HASH_B64;
    vi.clearAllMocks();
  });

  it("returns an error and does not set a session when the password field is missing", async () => {
    const state = await login({ error: null }, formDataWithPassword());

    expect(state).toEqual({ error: "Password is required" });
    expect(setSessionCookie).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns an error and does not set a session when the password is wrong", async () => {
    const state = await login({ error: null }, formDataWithPassword("wrong-password"));

    expect(state).toEqual({ error: "Incorrect password" });
    expect(setSessionCookie).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sets the session cookie and redirects to the dashboard on the correct password", async () => {
    await login({ error: null }, formDataWithPassword(REAL_PASSWORD));

    expect(setSessionCookie).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith(ROUTE.OVERVIEW);
  });
});

describe("logout", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("clears the session cookie and redirects to /login", async () => {
    await logout();

    expect(clearSessionCookie).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith(ROUTE.LOGIN);
  });
});
