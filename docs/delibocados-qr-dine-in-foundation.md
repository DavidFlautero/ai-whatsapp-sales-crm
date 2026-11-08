# Delibocados — QR dine-in (development stage, not live)

## Implemented in PR #22

- Secure `restaurant_ops_qr_tables` registry mapping one editor table ID to a
  server-side UUID, a SHA-256 digest of a random QR token and an enabled flag.
- Separate restaurant-wide QR general digest; all QR entries disabled by default.
- New `restaurant_ops_orders.fulfillment_mode='dine_in'` with verified table ID
  and QR kind, without changing existing pickup/delivery rows.
- `restaurant_ops_create_qr_order`: backend-only PostgreSQL RPC, atomic checkout,
  current menu/price validation, per-source-key advisory lock, idempotency,
  independent table/general token checking and single kitchen ticket.
- New POS360 outbox registration triggered by the QR dine-in order; **ledger only**,
  no POS360 transport, printing or automatic claim.
- Public API POST `/public/delibocados-qr/context` and `/order` through
  `apps/api`, plus the new publicly accessible restaurant-page
  `/qr-pedido` and same-origin Next API proxy.
- CI checks TypeScript/Next build and isolated PostgreSQL actual SQL smoke.

## Mandatory operational gates

**No public checkout is activated by installing this PR.**

1. API and Next panel processes must BOTH opt-in with
   `DELIBOCADOS_QR_CHECKOUT_ENABLED=1`. Do not enable this until after an
   approved single-table pilot.
2. Existing QR editor at Python port 3500 is **not yet synchronized** with the
   new secure QR registry. The current QR images and `/restaurant-qr/image`
   may point to an older menu route; do not claim they can place orders.
3. Generate a fresh cryptographic token of 32+ characters **for every table**
   and for the general QR; store only SHA-256 digest in PostgreSQL and build
   new QR links. Do not reuse short, predictable editor identifiers as tokens.
4. New QR link format:
   `https://panel.delibocados.online/qr-pedido#kind=table&tableId=<server-uuid>&token=<secret>`
   or `kind=general` plus a mandatory valid tableId.
   Hash fragments are not sent in normal HTTP requests. Protect tokens as
   bearer capabilities; printed QRs can be copied.
5. Public QR customers provide name, phone and confirm their items/total.
   Payments by transfer remain pending approval; cash is still outstanding
   until collected, despite legacy status `cash_on_delivery`.
6. The public UI is **not a substitute for POS360**: before POS360 acceptance,
   the page only reports local recording, not printed or received in kitchen.
7. Do not turn on QR ordering for real customers until POS360 connector,
   kitchen workflow, payment ownership and policy for unpaid in-room orders
   are approved and end-to-end receipt/print have been tested.

## Installing safely on the VPS

After PR is merged and CI succeeds, with a terminal at
`root@neuromind33:/var/www/control`:

```bash
bash scripts/deploy/delibocados-qr-foundation-apply.sh
```

The script backs up PostgreSQL, applies two idempotently-tracked migrations,
checks schema/RPC and reports the number of enabled QR tokens without exposing
them. It does not restart services or activate the feature flag.

## Still pending

- Controlled and authenticated synchronization between the existing Python QR
  editor and the hashed table/general QR registry.
- Audit and production-grade distributed rate limiting (current prototype
  is a per-process in-memory limiter).
- New QR image generation/link reprinting, reverse-proxy routing, and real
  device testing.
- POS360 Windows bridge and vendor-verified transport; outbound delivery
  remains disconnected and cannot claim a physical print.
- QR sale flow for split payments and corrections; cancellation/reservation
  edge cases after POS acceptance.
