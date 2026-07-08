import { ApiValidationError } from "@/lib/api/validation";

// Opaque cursor = base64url JSON of the last row's { createdAt, id }, used as
// a compound (timestamp, id) key so pagination stays stable even when two
// rows share the same createdAt. Shared by invoices.ts and webhooks.ts list
// queries, which both paginate on this same (createdAt, id) shape.
export interface CreatedAtCursor {
  createdAt: string;
  id: string;
}

export function encodeCursor(cursor: CreatedAtCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(raw: string): CreatedAtCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "createdAt" in parsed &&
      "id" in parsed &&
      typeof (parsed as CreatedAtCursor).createdAt === "string" &&
      typeof (parsed as CreatedAtCursor).id === "string"
    ) {
      return parsed as CreatedAtCursor;
    }
    throw new Error("malformed cursor payload");
  } catch (error) {
    throw new ApiValidationError(
      "VALIDATION_ERROR",
      `Invalid cursor: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}
