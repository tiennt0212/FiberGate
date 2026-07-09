#!/usr/bin/env node
// One-off CLI for local testing (see README.md "Pay a demo invoice with a
// second local node (fiber-node-payer)"): converts fiber-node's pubkey
// (from its own node_info RPC) into a full multiaddr fiber-node-payer can
// pass to connect_peer — first contact with an unknown peer needs a
// multiaddr, not just a pubkey (PeerNotFound otherwise). Uses
// @fiber-pay/sdk's buildMultiaddrFromNodeId (does the hex-pubkey → base58
// PeerId conversion + appends /p2p/<peerId>) instead of hand-rolling that
// encoding.
//
// Usage: node scripts/build-payer-multiaddr.mjs <fiber-node pubkey hex>
// (base address is fiber-node's known static IP/port, docker-compose.yml's
// 172.28.0.10:8228 — hardcoded here since it's fixed, not merchant-configurable)

import { buildMultiaddrFromNodeId } from "@fiber-pay/sdk";

const FIBER_NODE_BASE_ADDRESS = "/ip4/172.28.0.10/tcp/8228";

const pubkey = process.argv[2];
if (!pubkey) {
  console.error("Usage: node scripts/build-payer-multiaddr.mjs <fiber-node pubkey hex>");
  console.error("Get the pubkey via: curl -s -X POST http://localhost:8227 -H 'Content-Type: application/json' \\");
  console.error(`  --data '{"id":1,"jsonrpc":"2.0","method":"node_info","params":[]}' | jq -r '.result.pubkey'`);
  process.exit(1);
}

const multiaddr = await buildMultiaddrFromNodeId(FIBER_NODE_BASE_ADDRESS, pubkey);
console.log(multiaddr);
