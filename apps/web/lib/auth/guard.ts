import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/** True when the current request carries a valid admin session cookie. */
export async function hasAdminSession(): Promise<boolean> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/** Guard for server actions — throws if the caller is not an authenticated admin. */
export async function requireAdminSession(): Promise<void> {
  if (!(await hasAdminSession())) {
    throw new Error("Unauthorized");
  }
}
