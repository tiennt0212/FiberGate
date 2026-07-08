// Same tiny helper as apps/web/lib/env.ts's requireEnv — duplicated rather
// than imported because this app must not depend on apps/web (it's a
// standalone consumer of @fibergate/sdk, same as any third-party merchant
// app would be).
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}
