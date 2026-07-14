---
type: glossary
domain: fiber-network
version: 1.0
last_updated: 2026-06-30
tags: [fiber, ckb, payment-channel, lightning]
---

# Fiber Network — Glossary

> Bản public (VitePress): `docs/glossary.md`. Sửa 1 trong 2 file thì kiểm tra file
> còn lại trong cùng lần sửa (xem `.context/INDEX.md`'s "Public docs mirror").

## Fiber Network
Mạng payment channel peer-to-peer xây dựng trên Nervos CKB. Tương tự Bitcoin Lightning Network nhưng hỗ trợ multi-asset (CKB, RUSD, UDT tokens).

## FNN (Fiber Network Node)
Reference implementation của Fiber protocol. Mỗi participant cần chạy một FNN để tham gia mạng.

## Payment Channel
Mối quan hệ trực tiếp giữa hai node. Tạo channel = lock CKB on-chain vào shared script. Sau đó exchange off-chain. Đóng channel = settle on-chain.

## Invoice
Yêu cầu thanh toán dạng Bech32m string (tương tự Lightning invoice). Chứa: amount, asset, payment_hash, expiry, description.

## Payment Hash
Định danh duy nhất của một invoice/payment (0x-prefixed hex). Dùng để query trạng thái thanh toán.

## Shannon
Đơn vị nhỏ nhất của CKB. 1 CKB = 100,000,000 Shannon. Tương tự satoshi trong Bitcoin.

## HTLC (Hash Time-Locked Contract)
Cơ chế bảo mật cho multi-hop payment. Đảm bảo hoặc tất cả hops thành công hoặc tất cả revert.

## Multi-hop Routing
Payment không cần channel trực tiếp giữa sender và receiver. Đi qua intermediate nodes nếu có đủ liquidity.

## Liquidity
Capacity khả dụng trong channel. Inbound liquidity = có thể nhận. Outbound liquidity = có thể gửi. Mỗi side phải reserve 99 CKB (không dùng được cho payment).

## LSP (Lightning Service Provider)
Đơn vị cung cấp dịch vụ infrastructure cho payment channel network: quản lý node, liquidity, routing. Đây là vai trò của FiberGate.

## UDT (User Defined Token)
Token tùy chỉnh trên CKB. Ví dụ: RUSD (stablecoin), SEAL.

## RUSD
Stablecoin trên CKB testnet. Type script: `code_hash: 0x1142755a044bf2ee358cba9f2da187ce928c91cd4dc8692ded0337efa677d21a`

## Public Testnet Nodes
- `fiber-testnet-public-bottle`: pubkey `02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71`
- `fiber-testnet-public-bracer`: pubkey `0291a6576bd5a94bd74b27080a48340875338fff9f6d6361fe6b8db8d0d1912fcc`

## Fiber RPC
JSON-RPC 2.0 API của FNN node. Default port: `8227`. Các method quan trọng:
- `new_invoice` — tạo invoice mới
- `get_invoice` — lấy trạng thái invoice
- `connect_peer` — kết nối với peer
- `open_channel` — mở channel
- `list_channels` — liệt kê channels

## CKBoost
Platform tổ chức hackathon, dùng CKB testnet tokens để đăng ký và submit.

## Internal Secret (trong FiberGate)
`FIBERGATE_INTERNAL_SECRET` — 1 shared secret duy nhất set qua env var lúc deploy (self-hosted, single-tenant), dùng để storefront app của merchant authenticate khi gọi `/api/v1/*`. Không phải per-client API key — so sánh constant-time, không bao giờ lưu trong DB.