import type {
  ApiResponse,
  CreateInvoiceParams,
  FiberGateConfig,
  Invoice,
  ListInvoicesParams,
  NodeInfo,
} from "./types.js";

/** Thrown when the gateway returns a non-2xx response or an `error` envelope. */
export class FiberGateApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "FiberGateApiError";
    this.code = code;
    this.status = status;
  }
}

class HttpClient {
  private readonly baseUrl: string;
  private readonly secret: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(config: FiberGateConfig) {
    if (!config.baseUrl) throw new Error("FiberGate: baseUrl is required");
    if (!config.internalSecret) throw new Error("FiberGate: internalSecret is required");
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.secret = config.internalSecret;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    if (!this.fetchImpl) {
      throw new Error("FiberGate: global fetch unavailable — pass config.fetch (Node < 18)");
    }
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/api/v1${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.secret}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new FiberGateApiError("NETWORK_ERROR", `Request failed: ${reason}`, 0);
    } finally {
      clearTimeout(timer);
    }

    const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
    if (!json) {
      throw new FiberGateApiError("INVALID_RESPONSE", `Non-JSON response (${res.status})`, res.status);
    }
    if (json.error) {
      throw new FiberGateApiError(json.error.code, json.error.message, res.status);
    }
    return json.data;
  }
}

export class FiberGate {
  private readonly http: HttpClient;
  readonly invoices: InvoicesResource;
  readonly node: NodeResource;

  constructor(config: FiberGateConfig) {
    this.http = new HttpClient(config);
    this.invoices = new InvoicesResource(this.http);
    this.node = new NodeResource(this.http);
  }
}

class InvoicesResource {
  constructor(private readonly http: HttpClient) {}

  create(params: CreateInvoiceParams): Promise<Invoice> {
    return this.http.request<Invoice>("POST", "/invoices", params);
  }

  get(id: string): Promise<Invoice> {
    return this.http.request<Invoice>("GET", `/invoices/${encodeURIComponent(id)}`);
  }

  list(params: ListInvoicesParams = {}): Promise<Invoice[]> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.asset) qs.set("asset", params.asset);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.http.request<Invoice[]>("GET", `/invoices${suffix}`);
  }
}

class NodeResource {
  constructor(private readonly http: HttpClient) {}

  info(): Promise<NodeInfo> {
    return this.http.request<NodeInfo>("GET", "/node/info");
  }
}
