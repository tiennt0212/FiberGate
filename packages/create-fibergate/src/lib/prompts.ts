import { cancel, confirm, isCancel, log, password as passwordPrompt, select, text } from "@clack/prompts";
import { hashAdminPassword, MAX_PASSWORD_BYTES } from "./admin-password";
import { randomHex32 } from "./secrets";
import { validateSecretChars } from "./validate-secret";

const HOSTNAME_RE = /^(localhost|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,})$/;

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
      validate: (value) =>
        HOSTNAME_RE.test((value ?? "").trim()) ? undefined : "Not a valid hostname (no port, no protocol).",
    }),
  );
  return domain.trim();
}

/** Asks `message`; if declined, cancels and exits the process (never returns `false`). */
export async function confirmOrExit(message: string): Promise<void> {
  const proceed = await ask(confirm({ message, initialValue: false }));
  if (!proceed) {
    cancel("Cancelled — nothing was written.");
    process.exit(0);
  }
}
