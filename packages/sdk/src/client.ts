import { webhooks } from "./webhooks";
import type {
  ApiResponse,
  CreateInvoiceInput,
  Invoice,
  ListInvoicesQuery,
  ListInvoicesResult,
  NodeInfo,
} from "./types";

// Mirrors apps/web's default GET /invoices page size
// (apps/web/lib/api/validation.ts's DEFAULT_LIST_LIMIT) — only used here as a
// defensive fallback if the server response is ever missing `meta.limit`;
// the live server always includes it.
const DEFAULT_LIST_LIMIT = 20;

export interface FiberGateOptions {
  /**
   * Base URL of your self-hosted FiberGate deployment's API — matches
   * .context/api/rest-api-spec.md's "Base URL", e.g.
   * `http://<merchant-host>:<port>/api/v1`. The SDK does not read this from
   * an environment variable itself; pass `process.env.FIBERGATE_BASE_URL`
   * (or equivalent) from your own app.
   */
  baseUrl: string;
  /**
   * Shared secret set via `FIBERGATE_INTERNAL_SECRET` on the FiberGate
   * deployment (CLAUDE.md "Auth flow cho API routes"). The SDK does not read
   * this from an environment variable itself; pass
   * `process.env.FIBERGATE_INTERNAL_SECRET` (or equivalent) from your own
   * app. Never log this value.
   */
  internalSecret: string;
}

/** Thrown when the FiberGate API responds with `{ data: null, error: { code, message } }`. */
export class FiberGateApiError extends Error {
  constructor(
    /** One of the codes in `FiberGateErrorCode` (types.ts), e.g. "NOT_FOUND". */
    public readonly code: string,
    message: string,
    /** HTTP status code of the response. */
    public readonly status: number,
  ) {
    super(message);
    this.name = "FiberGateApiError";
  }
}

function buildListInvoicesQueryString(query: ListInvoicesQuery | undefined): string {
  if (!query) {
    return "";
  }
  const params = new URLSearchParams();
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.asset) {
    params.set("asset", query.asset);
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.cursor) {
    params.set("cursor", query.cursor);
  }
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

/**
 * Typed client for the FiberGate REST API (US-002). Construct one per
 * deployment:
 *
 * ```ts
 * const gateway = new FiberGate({
 *   baseUrl: process.env.FIBERGATE_BASE_URL!,
 *   internalSecret: process.env.FIBERGATE_INTERNAL_SECRET!,
 * })
 * ```
 */
export class FiberGate {
  /** Same helper as the standalone `webhooks` export, exposed as `gateway.webhooks.verify(...)`. */
  readonly webhooks = webhooks;

  readonly invoices = {
    /** POST /invoices — create a new invoice. */
    create: async (input: CreateInvoiceInput): Promise<Invoice> => {
      const { data } = await this.request<Invoice>("/invoices", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return data;
    },

    /** GET /invoices/:id — fetch a single invoice's current status. */
    get: async (id: string): Promise<Invoice> => {
      const { data } = await this.request<Invoice>(`/invoices/${encodeURIComponent(id)}`);
      return data;
    },

    /** GET /invoices — list invoices with optional filters, cursor-paginated. */
    list: async (query?: ListInvoicesQuery): Promise<ListInvoicesResult> => {
      const { data, meta } = await this.request<Invoice[]>(
        `/invoices${buildListInvoicesQueryString(query)}`,
      );
      const limit = typeof meta?.limit === "number" ? meta.limit : (query?.limit ?? DEFAULT_LIST_LIMIT);
      const nextCursor = typeof meta?.next_cursor === "string" ? meta.next_cursor : null;
      return { invoices: data, limit, next_cursor: nextCursor };
    },
  };

  readonly node = {
    /**
     * GET /node/info — public endpoint, does not require `internalSecret` to
     * succeed server-side (the SDK still sends the Authorization header on
     * every request for simplicity; the server just ignores it here).
     */
    getInfo: async (): Promise<NodeInfo> => {
      const { data } = await this.request<NodeInfo>("/node/info");
      return data;
    },
  };

  private readonly baseUrl: string;

  constructor(private readonly options: FiberGateOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
  ): Promise<{ data: T; meta?: Record<string, unknown> }> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${this.options.internalSecret}`,
        "content-type": "application/json",
        ...init?.headers,
      },
    });

    let body: ApiResponse<T>;
    try {
      body = (await response.json()) as ApiResponse<T>;
    } catch (error) {
      throw new Error(
        `FiberGate API returned a non-JSON response (status ${response.status})`,
        { cause: error },
      );
    }

    if (body.error !== null) {
      throw new FiberGateApiError(body.error.code, body.error.message, response.status);
    }

    return { data: body.data, meta: body.meta };
  }
}
