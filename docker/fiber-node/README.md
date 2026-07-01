# fiber-node configuration

FiberGate talks to a Fiber Network Node (FNN) over JSON-RPC on the internal
docker network — it does **not** ship the FNN binary itself.

To run the bundled `fiber-node` service:

1. Set `FIBER_NODE_IMAGE` in your `.env` to the FNN image + tag you intend to run.
2. Place your FNN node config in this directory (`docker/fiber-node/`). It is
   mounted read-only into the container at `/fiber/config`.
3. The node's key and channel state live in the `fiberdata` docker volume, so
   they belong to **you** (self-custody) — FiberGate never holds them.

Your node must:

- Expose JSON-RPC on port `8227` (the value of `FIBER_NODE_URL`).
- Have at least one channel with inbound liquidity so it can receive payments
  (see the dashboard's **Low capacity** warning).

Biscuit auth (`FIBER_NODE_SECRET`) is optional and off by default: the RPC port
is only reachable inside the docker network, never published to the host.
