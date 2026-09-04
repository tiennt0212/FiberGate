import { cancel, confirm, isCancel, log, password as passwordPrompt, select, text } from "@clack/prompts";
import { hashAdminPassword, MAX_PASSWORD_BYTES } from "./admin-password";
import { randomHex32 } from "./secrets";
import { validateSecretChars } from "./validate-secret";

const HOSTNAME_RE = /^(localhost|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,})$/;

/**
 * Shared by every hostname prompt so the rule and its wording stay in one
 * place. Returns undefined when valid, matching clack's `validate:` contract.
 */
function validateHostname(value: string | undefined): string | undefined {
  return HOSTNAME_RE.test((value ?? "").trim())
    ? undefined
    : "Not a valid hostname (no port, no protocol).";
}

/** Unwraps a clack prompt result, exiting cleanly if the user cancelled (Ctrl+C). */
export async function ask<T>(promise: Promise<T | symbol>): Promise<T> {
  const result = await promise;
  if (isCancel(result)) {
    cancel("Cancelled — nothing was written.");
    process.exit(0);
  }
  // isCancel()'s `value is symbol` guard doesn't narrow an unconstrained
  // generic T back down for TS — the symbol case has already exited above.
  return result as T;
}

export async function askSecretValue(label: string, envVarName: string): Promise<string> {
  const choice = await ask(
    select({
      message: `${label}:`,
      options: [
        { value: "generate", label: "Generate a random value for me (recommended)" },
        { value: "custom", label: "Enter my own" },
      ],
    }),
  );
  if (choice === "generate") {
    const value = randomHex32();
    log.success(`${envVarName} generated.`);
    return value;
  }
  return ask(
    passwordPrompt({
      message: `Enter ${envVarName}:`,
      validate: validateSecretChars,
    }),
  );
}

export async function promptPostgres(): Promise<{ user: string; db: string; password: string }> {
  const user = await ask(text({ message: "Postgres user:", initialValue: "fibergate" }));
  const db = await ask(text({ message: "Postgres database name:", initialValue: "fibergate" }));
  const password = await askSecretValue("Postgres password", "POSTGRES_PASSWORD");
  return { user, db, password };
}

export async function promptAdminPassword(): Promise<string> {
  const plaintext = await ask(
    passwordPrompt({
      message: "Choose the initial dashboard admin password (changeable later from Settings):",
      validate: (value) => {
        if (!value) return "Required.";
        if (Buffer.byteLength(value, "utf-8") > MAX_PASSWORD_BYTES) {
          return `Must be at most ${MAX_PASSWORD_BYTES} bytes (bcrypt silently truncates beyond that).`;
        }
        return undefined;
      },
    }),
  );
  const confirmation = await ask(passwordPrompt({ message: "Confirm password:" }));
  if (confirmation !== plaintext) {
    log.error("Passwords didn't match.");
    return promptAdminPassword();
  }
  return hashAdminPassword(plaintext);
}

export async function promptDomain(): Promise<string> {
  const domain = await ask(
    text({
      message:
        "Domain for this deploy — e.g. localhost (local testing, self-signed cert), or " +
        "deploy.example.com (DNS must point at this host for a real TLS cert):",
      initialValue: "localhost",
      validate: validateHostname,
    }),
  );
  return domain.trim();
}

/**
 * `localhost` is the wizard's own default DOMAIN for local testing and is never
 * fronted by a CDN, so asking about proxying there is pure noise. Exported so
 * the branch is testable without driving an interactive prompt.
 */
export function needsP2pDomainPrompt(domain: string): boolean {
  return domain.trim().toLowerCase() !== "localhost";
}

/**
 * Asks whether `domain` is served through a CDN proxy and, if so, collects the
 * DNS-only hostname `fiber-node` should announce instead. Returns "" when the
 * question doesn't apply or the answer is no — the compose files fall back to
 * DOMAIN, which is right for every deploy with nothing in front of it.
 *
 * Worth one extra prompt because the failure it prevents is completely silent:
 * a proxied record forwards only HTTP/HTTPS ports, so port 8228 dies at the CDN
 * edge while the dashboard on 443 keeps working perfectly. The node then
 * announces an address no peer can dial, passes every health check, and simply
 * never receives a payment. See .context/processes/gotchas.md.
 */
export async function promptP2pDomain(domain: string): Promise<string> {
  if (!needsP2pDomainPrompt(domain)) return "";

  const proxied = await ask(
    confirm({
      message: `Is ${domain} served through a CDN proxy? (Cloudflare: is the cloud icon orange, not grey?)`,
      initialValue: false,
    }),
  );
  if (!proxied) return "";

  log.warn(
    `A proxied record forwards only HTTP/HTTPS ports, so fiber-node's port 8228 never reaches this host.\n` +
      `Add a second DNS record pointing at this same machine with the proxy turned OFF\n` +
      `(Cloudflare: grey cloud), then enter it below. ${domain} keeps its CDN for the dashboard.`,
  );

  const p2pDomain = await ask(
    text({
      message: "DNS-only hostname for fiber-node's P2P/WSS address:",
      placeholder: `fiber.${domain}`,
      validate: (value) =>
        validateHostname(value) ??
        ((value ?? "").trim() === domain.trim()
          ? "Must differ from the domain above — that one is proxied."
          : undefined),
    }),
  );
  return p2pDomain.trim();
}

/** Asks `message`; if declined, cancels and exits the process (never returns `false`). */
export async function confirmOrExit(message: string): Promise<void> {
  const proceed = await ask(confirm({ message, initialValue: false }));
  if (!proceed) {
    cancel("Cancelled — nothing was written.");
    process.exit(0);
  }
}
