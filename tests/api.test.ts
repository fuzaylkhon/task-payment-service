import { describe, test, expect, beforeEach } from "vitest";
import request from "supertest";
import { v4 as uuidv4 } from "uuid";
import type { Express } from "express";
import { buildApp, sendSignedWebhook, TEST_CONFIG } from "./helpers/testApp";
import {
  InMemoryInvoiceRepository,
  InMemoryMerchantRepository,
} from "./helpers/inMemoryRepos";
import type { Merchant } from "../src/types";

let app: Express;
let merchants: InMemoryMerchantRepository;
let merchant: Merchant;

beforeEach(() => {
  const built = buildApp();
  app = built.app;
  merchants = built.merchants as InMemoryMerchantRepository;
  merchant = merchants.add({ name: "M", feePercent: 2.5, balance: 0 });
});

describe("POST /invoice", () => {
  test("creates invoice with calculated amounts", async () => {
    const res = await request(app)
      .post("/invoice")
      .send({ amount: 10000, currency: "usd", merchantId: merchant.id });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      fee: 250,
      amountToReceive: 9750,
      status: "pending",
      currency: "USD",
    });
    expect(res.body.invoiceId).toBeDefined();
    expect(res.body.idempotencyKey).toBeDefined();
  });

  test("same Idempotency-Key returns existing invoice", async () => {
    const payload = { amount: 5000, currency: "USD", merchantId: merchant.id };
    const first = await request(app)
      .post("/invoice")
      .set("Idempotency-Key", "k1")
      .send(payload);
    const second = await request(app)
      .post("/invoice")
      .set("Idempotency-Key", "k1")
      .send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.invoiceId).toBe(first.body.invoiceId);
  });

  test("400 on invalid body (zod)", async () => {
    const res = await request(app)
      .post("/invoice")
      .send({ amount: -5, currency: "USD", merchantId: merchant.id });
    expect(res.status).toBe(400);
  });

  test("404 for unknown merchant", async () => {
    const res = await request(app).post("/invoice").send({
      amount: 100,
      currency: "USD",
      merchantId: "64b000000000000000000000",
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /invoice/:id", () => {
  test("returns invoice status", async () => {
    const created = await request(app)
      .post("/invoice")
      .send({ amount: 1000, currency: "EUR", merchantId: merchant.id });

    const res = await request(app).get(`/invoice/${created.body.invoiceId}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending");
  });

  test("404 for missing invoice", async () => {
    const res = await request(app).get("/invoice/64b000000000000000000000");
    expect(res.status).toBe(404);
  });
});

describe("POST /webhook", () => {
  async function createInvoice(): Promise<string> {
    const res = await request(app)
      .post("/invoice")
      .send({ amount: 10000, currency: "USD", merchantId: merchant.id });
    return res.body.invoiceId as string;
  }

  test("400 on missing signature headers", async () => {
    const res = await request(app)
      .post("/webhook")
      .send({ invoiceId: "x", status: "paid" });
    expect(res.status).toBe(400);
  });

  test("401 on invalid signature", async () => {
    const invoiceId = await createInvoice();
    const res = await sendSignedWebhook(
      app,
      { invoiceId, status: "paid" },
      { signature: "ff".repeat(32) },
    );
    expect(res.status).toBe(401);
  });

  test("401 on stale timestamp", async () => {
    const invoiceId = await createInvoice();
    const stale = String(
      Math.floor(Date.now() / 1000) - TEST_CONFIG.timestampToleranceSec - 60,
    );
    const res = await sendSignedWebhook(
      app,
      { invoiceId, status: "paid" },
      { timestamp: stale },
    );
    expect(res.status).toBe(401);
  });

  test("valid paid webhook credits merchant", async () => {
    const invoiceId = await createInvoice();
    const res = await sendSignedWebhook(app, { invoiceId, status: "paid" });

    expect(res.status).toBe(200);
    expect(res.body.credited).toBe(true);
    expect(merchant.balance).toBe(9750);
  });

  test("409 on nonce replay", async () => {
    const invoiceId = await createInvoice();
    const nonce = uuidv4();
    const first = await sendSignedWebhook(
      app,
      { invoiceId, status: "paid" },
      { nonce },
    );
    const second = await sendSignedWebhook(
      app,
      { invoiceId, status: "paid" },
      { nonce },
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
  });

  test("redelivery with new nonce credits only once", async () => {
    const invoiceId = await createInvoice();
    const first = await sendSignedWebhook(app, { invoiceId, status: "paid" });
    const second = await sendSignedWebhook(app, { invoiceId, status: "paid" });

    expect(first.body.credited).toBe(true);
    expect(second.status).toBe(200);
    expect(second.body.credited).toBe(false);
    expect(merchant.balance).toBe(9750);
  });

  test("failed status does not credit", async () => {
    const invoiceId = await createInvoice();
    const res = await sendSignedWebhook(app, { invoiceId, status: "failed" });
    expect(res.status).toBe(200);
    expect(merchant.balance).toBe(0);
  });

  test("404 for unknown invoice", async () => {
    const res = await sendSignedWebhook(app, {
      invoiceId: "64b000000000000000000000",
      status: "paid",
    });
    expect(res.status).toBe(404);
  });
});
