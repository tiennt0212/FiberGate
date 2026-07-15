---
type: glossary
domain: fiber-network
version: 1.0
last_updated: 2026-06-30
tags: [fiber, ckb, payment-channel, lightning]
---

# Fiber Network — Glossary

> Public version (VitePress): `docs/glossary.md`. If you edit one of the two files, check the
> other one in the same edit (see `.context/INDEX.md`'s "Public docs mirror").

## Fiber Network
A peer-to-peer payment channel network built on Nervos CKB. Similar to the Bitcoin Lightning Network but supports multiple assets (CKB, RUSD, UDT tokens).

## FNN (Fiber Network Node)
The reference implementation of the Fiber protocol. Each participant runs an FNN to join the network.

## Payment Channel
A direct relationship between two nodes. Opening a channel = locking CKB on-chain into a shared script. Payments are then exchanged off-chain. Closing a channel = settling on-chain.

## Invoice
A payment request in Bech32m string format (similar to a Lightning invoice). Contains: amount, asset, payment_hash, expiry, description.

## Payment Hash
The unique identifier of an invoice/payment (0x-prefixed hex). Used to query payment status.

## Shannon
The smallest unit of CKB. 1 CKB = 100,000,000 Shannon. Analogous to a satoshi in Bitcoin.

## HTLC (Hash Time-Locked Contract)
A security mechanism for multi-hop payments. Guarantees that either all hops succeed or all revert.

## Multi-hop Routing
A payment doesn't need a direct channel between sender and receiver — it can route through intermediate nodes as long as they have sufficient liquidity.

## Liquidity
The capacity available in a channel. Inbound liquidity = capacity to receive. Outbound liquidity = capacity to send. Each side must reserve 99 CKB (not usable for payments).

## LSP (Lightning Service Provider)
An entity that provides infrastructure services for the payment channel network: node management, liquidity, routing. This is FiberGate's role.

## UDT (User Defined Token)
A custom token on CKB. Examples: RUSD (stablecoin), SEAL.

## RUSD
A stablecoin on the CKB testnet. Type script: `code_hash: 0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a`

## Public Testnet Nodes
- `fiber-testnet-public-bottle`: pubkey `02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71`
- `fiber-testnet-public-bracer`: pubkey `0291a6576bd5a94bd74b27080a48340875338fff9f6d6361fe6b8db8d0d1912fcc`

## Fiber RPC
The FNN node's JSON-RPC 2.0 API. Default port: `8227`. Key methods:
- `new_invoice` — create a new invoice
- `get_invoice` — get invoice status
- `connect_peer` — connect to a peer
- `open_channel` — open a channel
- `list_channels` — list channels

## CKBoost
The platform organizing the hackathon; uses CKB testnet tokens for registration and submission.

## Internal Secret (in FiberGate)
`FIBERGATE_INTERNAL_SECRET` — a single shared secret set via an env var at deploy time (self-hosted, single-tenant), used by the merchant's storefront app to authenticate when calling `/api/v1/*`. Not a per-client API key — compared in constant time, never stored in the DB.