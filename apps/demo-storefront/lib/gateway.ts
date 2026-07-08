import { FiberGate } from "@fibergate/sdk";

import { requireEnv } from "./env";

// One FiberGate client per call site (cheap — just closes over baseUrl/secret,
// no connection pooling), pointed at the FiberGate deployment this storefront
// integrates with. `FIBERGATE_BASE_URL` is the root URL (no `/api/v1` suffix)
// — e.g. `http://localhost:3000` for local dev, `http://fibergate-core:3000`
// under docker-compose.demo.yml's shared network.
export function getGateway(): FiberGate {
  return new FiberGate({
    baseUrl: `${requireEnv("FIBERGATE_BASE_URL")}/api/v1`,
    internalSecret: requireEnv("FIBERGATE_INTERNAL_SECRET"),
  });
}
