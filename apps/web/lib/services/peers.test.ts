import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/fiber/client", () => ({
  listPeersDetailed: vi.fn(),
}));

const { listPeersDetailed } = await import("@/lib/fiber/client");
const { listPeers } = await import("./peers");

afterEach(() => {
  vi.clearAllMocks();
});

describe("listPeers", () => {
  it("passes through the fiber client's pubkey/address list unchanged", async () => {
    vi.mocked(listPeersDetailed).mockResolvedValue([{ pubkey: "02aaaa", address: "/ip4/1.2.3.4/tcp/8228" }]);

    await expect(listPeers()).resolves.toEqual([{ pubkey: "02aaaa", address: "/ip4/1.2.3.4/tcp/8228" }]);
  });
});
