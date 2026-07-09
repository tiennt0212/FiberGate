import { beforeEach, describe, expect, it, vi } from "vitest";

// client.ts builds a FiberSDK singleton at import time (requireEnv("FIBER_NODE_URL")),
// so the env var must exist before the module under test is ever imported, and
// @ckb-ccc/fiber's FiberSDK class must be mocked before that too.
process.env.FIBER_NODE_URL = "http://test-fiber-node:8227";

const getNodeInfo = vi.fn();
const newInvoice = vi.fn();

// Reflect.construct (used internally by vi.fn().mockImplementation to honor
// `new FiberSDK(...)`) requires a constructible function — an arrow function
// implementation throws "is not a constructor", so this must be `function`.
vi.mock("@ckb-ccc/fiber", () => ({
  FiberSDK: vi.fn().mockImplementation(function FiberSDKMock() {
    return { getNodeInfo, newInvoice };
  }),
}));

// resolveUdtTypeScript()'s cache is process-lifetime module state (issue #27
// decision) — vi.resetModules() + a fresh dynamic import gives each test its
// own uncached client.ts, except the "caching" test below which deliberately
// imports once and calls createInvoice() twice to exercise the cache hit.
async function importClient() {
  vi.resetModules();
  return import("./client");
}

const RUSD_SCRIPT = {
  codeHash: "0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a",
  hashType: "type",
  args: "0x878fcc6f1f08d48e87bb1c3b3d5083f23f8a39c5d5c764f253b55b998526439b",
};

// Shared getNodeInfo()/newInvoice() response shapes so each test body only
// spells out what it's actually asserting on, not the SDK's field nesting.
function rusdWhitelisted(): { udtCfgInfos: Array<{ name: string; script: typeof RUSD_SCRIPT }> } {
  return { udtCfgInfos: [{ name: "RUSD", script: RUSD_SCRIPT }] };
}
function newInvoiceResult(paymentHash: string, invoiceAddress = "fibt1qrusd") {
  return { invoiceAddress, invoice: { data: { paymentHash } } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createInvoice", () => {
  it("creates a CKB invoice without ever calling node_info", async () => {
    const { createInvoice } = await importClient();
    newInvoice.mockResolvedValue(newInvoiceResult("0xhash1", "fibt1qckb"));

    const result = await createInvoice({ amountShannon: 100_000_000n, asset: "CKB" });

    expect(getNodeInfo).not.toHaveBeenCalled();
    expect(newInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "Fibt", udtTypeScript: undefined }),
    );
    expect(result.invoiceAddress).toBe("fibt1qckb");
    expect(result.paymentHash).toBe("0xhash1");
  });

  it("resolves RUSD's UDT type script via node_info and passes it to newInvoice", async () => {
    const { createInvoice } = await importClient();
    getNodeInfo.mockResolvedValue(rusdWhitelisted());
    newInvoice.mockResolvedValue(newInvoiceResult("0xhash2"));

    await createInvoice({ amountShannon: 100_000_000n, asset: "RUSD" });

    expect(getNodeInfo).toHaveBeenCalledTimes(1);
    expect(newInvoice).toHaveBeenCalledWith(expect.objectContaining({ udtTypeScript: RUSD_SCRIPT }));
  });

  it("caches the UDT script lookup — a second RUSD invoice doesn't call node_info again", async () => {
    const { createInvoice } = await importClient();
    getNodeInfo.mockResolvedValue(rusdWhitelisted());
    newInvoice.mockResolvedValue(newInvoiceResult("0xhash3"));

    await createInvoice({ amountShannon: 100_000_000n, asset: "RUSD" });
    await createInvoice({ amountShannon: 200_000_000n, asset: "RUSD" });

    expect(getNodeInfo).toHaveBeenCalledTimes(1);
    expect(newInvoice).toHaveBeenCalledTimes(2);
  });

  it("throws UdtNotConfiguredError when the node's udt_whitelist has no RUSD entry", async () => {
    const { createInvoice } = await importClient();
    const { UdtNotConfiguredError } = await import("./types");
    getNodeInfo.mockResolvedValue({ udtCfgInfos: [] });

    await expect(
      createInvoice({ amountShannon: 100_000_000n, asset: "RUSD" }),
    ).rejects.toBeInstanceOf(UdtNotConfiguredError);
    expect(newInvoice).not.toHaveBeenCalled();
  });

  it("re-checks node_info on the next call after a miss, instead of caching 'not configured' forever", async () => {
    // Regression test: an operator can fix docker/fiber-node/config.yml's
    // ckb.udt_whitelist and restart just fiber-node (docker-compose's
    // depends_on does not restart fibergate-core too) — the next RUSD
    // invoice attempt must re-query node_info rather than staying stuck on
    // a stale "not configured" result cached before the fix.
    const { createInvoice } = await importClient();
    const { UdtNotConfiguredError } = await import("./types");
    getNodeInfo.mockResolvedValueOnce({ udtCfgInfos: [] });
    getNodeInfo.mockResolvedValueOnce(rusdWhitelisted());
    newInvoice.mockResolvedValue(newInvoiceResult("0xhash4"));

    await expect(
      createInvoice({ amountShannon: 100_000_000n, asset: "RUSD" }),
    ).rejects.toBeInstanceOf(UdtNotConfiguredError);
    await createInvoice({ amountShannon: 100_000_000n, asset: "RUSD" });

    expect(getNodeInfo).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight node_info lookup across concurrent RUSD invoice requests", async () => {
    // Regression test: caching only the *resolved* value left a
    // check-then-act race where concurrent callers arriving before the
    // first node_info response landed would each fire their own RPC.
    const { createInvoice } = await importClient();
    let resolveNodeInfo!: (value: ReturnType<typeof rusdWhitelisted>) => void;
    getNodeInfo.mockReturnValue(
      new Promise((resolve) => {
        resolveNodeInfo = resolve;
      }),
    );
    newInvoice.mockResolvedValue(newInvoiceResult("0xhash5"));

    const first = createInvoice({ amountShannon: 100_000_000n, asset: "RUSD" });
    const second = createInvoice({ amountShannon: 200_000_000n, asset: "RUSD" });
    resolveNodeInfo(rusdWhitelisted());
    await Promise.all([first, second]);

    expect(getNodeInfo).toHaveBeenCalledTimes(1);
  });

  it("throws UnsupportedAssetError for any asset other than CKB/RUSD, without calling the RPC", async () => {
    const { createInvoice } = await importClient();
    const { UnsupportedAssetError } = await import("./types");

    await expect(
      createInvoice({ amountShannon: 100_000_000n, asset: "DOGE" }),
    ).rejects.toBeInstanceOf(UnsupportedAssetError);
    expect(getNodeInfo).not.toHaveBeenCalled();
    expect(newInvoice).not.toHaveBeenCalled();
  });
});
