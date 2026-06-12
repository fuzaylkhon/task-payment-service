# Payment Service

Invoice payment service: Node.js + Express + MongoDB + Redis.

## Requirements

- Node.js 20+
- pnpm
- Docker (for MongoDB and Redis)

## Run

```bash
docker compose up -d
pnpm install
cp .env.example .env
pnpm seed
pnpm dev
pnpm start
```

## API

- `POST /invoice` — `{amount, currency, merchantId}` (amount in minor units /
cents). Optional `Idempotency-Key` header: duplicates return the existing invoice with 200;  
UUID v4 is generated and stored when absent (unique index).
- `POST /webhook` — headers `X-Signature` (hex HMAC-SHA256 of
`"{timestamp}.{nonce}.{rawBody}"`), `X-Timestamp` (unix seconds, ±300s),
`X-Nonce` (unique; replay → 409). Body `{invoiceId, status: paid|failed}`.
The merchant is credited exactly once via an atomic `pending → paid`
transition; redelivered events return 200 with `credited: false`.
- `GET /invoice/:id`

Signing example:

```ts
const body = JSON.stringify({ invoiceId, status: "paid" });
const ts = String(Math.floor(Date.now() / 1000));
const nonce = crypto.randomUUID();
const sig = crypto.createHmac("sha256", SECRET).update(`${ts}.${nonce}.${body}`).digest("hex");
```

## Tests

```bash
pnpm test
pnpm typecheck
```

## Assumptions

Minor-unit integer money (fee rounded to nearest unit); 

signature covers
timestamp + nonce + body so headers are tamper-proof; 

no auth/registration;
`paid` invoices can't be downgraded to `failed`; 

replay protection =
timestamp window + Redis nonce dedup, business idempotency = atomic status
transition (safe even after nonce TTL expiry).

## With more time

- Mongo transactions (replica set) so invoice update + balance credit are one
atomic unit; reconciliation job for the crash window between the two ops.
- Ledger collection instead of a balance counter.
- OpenAPI docs at /docs, pino logging, rate limiting, graceful shutdown.

