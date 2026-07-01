import { env } from "@/lib/config/env";

// Signed dashboard session (BR-SEC-004). Uses Web Crypto so the same code runs in
// both middleware (edge runtime) and route handlers (node runtime).

export const SESSION_COOKIE = "fibergate_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

interface SessionPayload {
  sub: "admin";
  iat: number;
  exp: number;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): Uint8Array<ArrayBuffer> {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Fresh ArrayBuffer-backed bytes — satisfies Web Crypto's BufferSource typing.
function utf8(input: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(input));
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    utf8(env.sessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(ttlSeconds: number = SESSION_TTL_SECONDS): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { sub: "admin", iat: now, exp: now + ttlSeconds };
  const payloadB64 = b64urlEncode(utf8(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), utf8(payloadB64));
  return `${payloadB64}.${b64urlEncode(new Uint8Array(sig))}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return false;

  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(),
    b64urlDecode(sigB64),
    utf8(payloadB64),
  );
  if (!valid) return false;

  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))) as SessionPayload;
    return payload.sub === "admin" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
