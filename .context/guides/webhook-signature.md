---
type: guide
module: webhooks
version: 1.0
last_updated: 2026-07-05
tags: [webhook, hmac, security, signature]
---

# Webhook Signature — what HMAC-SHA256 is and why we use it

This document explains the mechanism behind `webhook_endpoints.secret` and the
`X-Fiber-Signature` header described in `.context/api/rest-api-spec.md` (the
"Webhook Payload" section) and `BR-WHK-004` (`.context/business-rules/payment-rules.md`).
Goal: help the reader understand **why** it's done this way, not just copy the verify code.

## 1. Why a plain hash (SHA-256) isn't enough to "sign"

SHA-256 is a one-way, deterministic hash function: `hash(data) → digest`. It
**takes no key** — anyone can compute the exact same `sha256(payload)`,
because the algorithm is public and there's no secret involved at all.

If FiberGate only sent `sha256(payload)` without a secret, an attacker who
intercepted the request could:
1. Modify the payload arbitrarily.
2. Recompute `sha256(modified_payload)`.
3. Send both to the merchant — the merchant would have no way to detect the forgery.

→ A plain hash is only useful when you *already trust* the source of that hash
value (e.g. a downloaded file's checksum). It doesn't prove **who** produced
the digest, since no secret is needed to reproduce it.

## 2. Where HMAC "injects" the key

HMAC-SHA256 isn't "SHA-256 with an extra key parameter" — it's its own
construction (RFC 2104) that uses SHA-256 as an internal building block,
hashing in two layers:

```
HMAC(K, m) = SHA256( (K' XOR opad) || SHA256( (K' XOR ipad) || m ) )
```

- `K'`: the secret key, padded/hashed to fill the block size (64 bytes for SHA-256).
- `ipad`, `opad`: two fixed, distinct constants XORed with the key.
- `m`: the payload being signed.

The key point: computing the correct `HMAC(K, m)` requires knowing `K`. Without
the secret, you cannot reproduce this value, even knowing both the algorithm
and `m` in advance. This is what turns a "public" hash into an authentication
mechanism with a secret.

## 3. Why not simply `SHA256(secret + payload)`?

SHA-256 belongs to the Merkle–Damgård family, which is vulnerable to
**length-extension attacks**: if you simply concatenate `secret || payload`
and hash it, an attacker who knows `H(secret || payload)` (**without knowing**
`secret`) can still compute `H(secret || payload || padding || extra)` for
arbitrary `extra` data — i.e. "append" data to the signed payload without ever
knowing the secret.

HMAC's two-layer ipad/opad structure is specifically designed to block this
exact vulnerability. This is why you must use a proper HMAC implementation
(`crypto.createHmac` or equivalent), not roll your own by concatenating
strings and hashing.

## 4. Applying this to FiberGate's webhooks

- Each endpoint a merchant registers has its own `webhook_endpoints.secret`
  (a random string, stored encrypted — see
  `.context/data-dictionary/database-schema.md`).
- FiberGate and the merchant **both know** this same secret.
- When sending a webhook (`payment.paid` / `invoice.expired` / `invoice.failed`):
  ```
  signature = HMAC-SHA256(secret, raw_payload_bytes)
  ```
  attached in the `X-Fiber-Signature: sha256=<hex>` header (BR-WHK-004).
- The merchant receives the request, recomputes the HMAC over the **raw body**
  it received, and compares it against the signature in the header (see
  the sample verify code in `.context/api/rest-api-spec.md`'s "Webhook Payload"
  section).

A match proves two things at once:

1. **Integrity** — the payload wasn't modified in transit.
2. **Authenticity** — the request genuinely came from a party that knows
   `secret` (assuming only FiberGate and the merchant know it), not someone
   crafting a fake request to the merchant's webhook URL.

## 5. Implementation / verification notes

- Signature comparison must use a **constant-time compare** (not a plain
  string `===`) to avoid timing attacks — the same principle applies to
  `FIBERGATE_INTERNAL_SECRET` at the API auth layer (see `CLAUDE.md`'s "Auth
  flow for API routes" section).
- HMAC must be computed over the **raw body** (the original byte string
  before JSON parsing), not a re-`JSON.stringify`'d object — because key
  order/whitespace can differ between the sent version and the re-parsed
  version, causing the signature to mismatch even when the payload is
  logically the same.
- The actual delivery mechanism (HMAC sign + send HTTP + retry + record
  `webhook_deliveries`) was implemented in issue #8 (BR-WHK-002/003/004/005):
  `apps/web/lib/webhooks/sign.ts` (HMAC), `apps/web/lib/webhooks/deliver.ts`
  (sends HTTP + classifies retryable/non-retryable, BR-WHK-006), and
  `apps/web/lib/webhooks/retry-scheduler.ts` (schedules the next attempt).
  The decrypted secret (`apps/web/lib/webhooks/secret-crypto.ts`) only exists
  in memory right at the point where `signWebhookPayload()` is called — it's
  never logged or returned outward.

## References

- `.context/business-rules/payment-rules.md` — BR-WHK-001 → BR-WHK-005
- `.context/api/rest-api-spec.md` — the "Webhook Payload" section (payload
  shape, header, sample verify code)
- `.context/data-dictionary/database-schema.md` — the `webhook_endpoints`,
  `webhook_deliveries` tables
- `apps/web/lib/webhooks/trigger.ts` — where webhooks are invoked from the
  poller (non-blocking dispatch, inserts `webhook_deliveries` + arms the
  first attempt)
- `apps/web/lib/webhooks/sign.ts`, `deliver.ts`, `retry-scheduler.ts`,
  `secret-crypto.ts` — HMAC signing, sending HTTP + retry, secret encryption
  at rest (issue #8)
