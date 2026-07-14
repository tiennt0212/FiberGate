# Glossary

Terms used throughout this documentation, for readers coming from a different
blockchain/payments background.

## Fiber Network

A peer-to-peer payment channel network built on Nervos CKB. Similar to the Bitcoin
Lightning Network, but with multi-asset support (native CKB, RUSD, and other UDT
tokens).

## FNN (Fiber Network Node)

The reference implementation of the Fiber protocol. Every participant runs an FNN
node to take part in the network.

## Payment Channel

A direct relationship between two nodes. Opening a channel locks CKB on-chain into a
shared script; payments after that happen off-chain. Closing a channel settles the
final balance back on-chain.

## Invoice

A payment request, encoded as a Bech32m string (similar to a Lightning invoice).
Contains an amount, asset, payment hash, expiry, and description.

## Payment Hash

The unique identifier for an invoice/payment (a `0x`-prefixed hex string), used to
query payment status.

## Shannon

The smallest unit of CKB — 1 CKB = 100,000,000 Shannon (comparable to a satoshi in
Bitcoin).

## HTLC (Hash Time-Locked Contract)

The security mechanism behind multi-hop payments — guarantees that either every hop
in a route succeeds, or the whole payment reverts.

## Multi-hop Routing

A payment doesn't need a direct channel between sender and receiver — it can route
through intermediate nodes that have enough liquidity.

## Liquidity

The available capacity in a channel. Inbound liquidity is how much you can receive;
outbound liquidity is how much you can send. Each side reserves 99 CKB that can't be
used for payments.

## LSP (Lightning Service Provider)

An entity that provides payment-channel infrastructure as a service — managing
nodes, liquidity, and routing on behalf of others. **FiberGate does not do this** —
see [Decisions & trade-offs](/decisions-and-tradeoffs) for why it's a self-hosted
gateway, not an LSP.

## UDT (User Defined Token)

A custom token standard on CKB. RUSD (a stablecoin) is one example.

## RUSD

A stablecoin on CKB testnet, supported alongside native CKB as an invoice asset.

## Fiber RPC

The JSON-RPC 2.0 API exposed by an FNN node (default port `8227`). Key methods
FiberGate relies on: `new_invoice`, `get_invoice`, `connect_peer`, `open_channel`,
`list_channels`.
