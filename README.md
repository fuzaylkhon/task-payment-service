# Payment Service

Invoice payment service: Node.js + Express + MongoDB + Redis.

## Requirements

- Node.js 20+
- pnpm
- Docker (for MongoDB and Redis)

## Run

```bash
docker compose up -d        # MongoDB + Redis
pnpm install
cp .env.example .env
pnpm seed
pnpm dev
pnpm start
```

## Structure

```
src/
  main.ts              entire startup: createApp(deps) factory + composition root + listen
  config.ts            env-based configuration
  errors.ts            typed HttpError hierarchy (400/401/404/409)
  schemas.ts           zod request schemas
  types.ts             domain shapes (Invoice, Merchant, NewInvoice) + NonceStore
  utils.ts             shared response mappers / helpers
  models/              Mongoose schemas (typed)
  repositories/        InvoiceRepository, MerchantRepository — all Mongoose access
  services/            fees, signature (HMAC), invoiceService, paymentService
  controllers/         zod validation + domain result -> HTTP mapping
  middleware/          verifyWebhookSignature, errorHandler
```

`main.ts` exports `createApp(deps)` so tests build the same app with in-memory
repositories; `main()` runs only when the file is executed directly.

Repositories are concrete classes; tests rely on TypeScript structural typing —
`InMemoryInvoiceRepository` has the same public methods, so it's assignable
wherever `InvoiceRepository` is expected.

Runtime note: imports are extension-less, so the project runs through `tsx`
(`moduleResolution: bundler`, `tsc --noEmit` for typechecking). If you need a
`node dist/` build later, switch tsconfig to `NodeNext` and add `.js`
extensions to relative imports.

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

- `tests/unit.test.ts` — fee math, HMAC generation/verification
- `tests/paymentService.test.ts` — exactly-once crediting with in-memory repos,
incl. concurrent deliveries
- `tests/api.test.ts` — full HTTP flows (supertest + in-memory repos +
ioredis-mock): signature rejection, stale timestamp, nonce replay,
redelivery idempotency, idempotent creation
- `tests/repositories.mongo.test.ts` — real Mongo implementations (atomic
`findOneAndUpdate`, unique-index race). Uses `mongodb-memory-server`
(downloads mongod on first run) or `TEST_MONGO_URI=mongodb://localhost:27017/payments-test pnpm test`

## Assumptions

Minor-unit integer money (fee rounded to nearest unit); signature covers
timestamp + nonce + body so headers are tamper-proof; no auth/registration;
`paid` invoices can't be downgraded to `failed`; replay protection =
timestamp window + Redis nonce dedup, business idempotency = atomic status
transition (safe even after nonce TTL expiry).

## With more time

- Mongo transactions (replica set) so invoice update + balance credit are one
atomic unit; reconciliation job for the crash window between the two ops.
- Ledger collection instead of a balance counter.
- OpenAPI docs at /docs, pino logging, rate limiting, graceful shutdown.

