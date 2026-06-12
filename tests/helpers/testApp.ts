import RedisMock from "ioredis-mock";
import request, { type Test } from "supertest";
import { v4 as uuidv4 } from "uuid";
import type { Express } from "express";
import { createApp } from "../../src/main";
import { InvoiceService } from "../../src/services/invoiceService";
import { PaymentService } from "../../src/services/paymentService";
import { generateHMAC } from "../../src/signature";
import type { NonceStore } from "../../src/types";
import type { InvoiceRepository } from "../../src/repositories/InvoiceRepository";
import type { MerchantRepository } from "../../src/repositories/MerchantRepository";
import {
  InMemoryInvoiceRepository,
  InMemoryMerchantRepository,
} from "./inMemoryRepos";

export const TEST_CONFIG = {
  webhookSecret: "test-secret",
  timestampToleranceSec: 300,
  nonceTtlSec: 600,
};

export function buildApp(repos?: {
  invoices: InvoiceRepository;
  merchants: MerchantRepository;
}) {
  const invoices = repos?.invoices ?? new InMemoryInvoiceRepository();
  const merchants = repos?.merchants ?? new InMemoryMerchantRepository();
  const nonceStore = new RedisMock() as unknown as NonceStore;

  const app = createApp({
    invoiceService: new InvoiceService(invoices, merchants),
    paymentService: new PaymentService(invoices, merchants),
    nonceStore,
    config: TEST_CONFIG,
  });

  return { app, invoices, merchants };
}

export function sendSignedWebhook(
  app: Express,
  body: object,
  overrides: { timestamp?: string; nonce?: string; signature?: string } = {},
): Test {
  const raw = JSON.stringify(body);
  const timestamp =
    overrides.timestamp ?? String(Math.floor(Date.now() / 1000));
  const nonce = overrides.nonce ?? uuidv4();
  const signature =
    overrides.signature ??
    generateHMAC(TEST_CONFIG.webhookSecret, timestamp, nonce, raw);

  return request(app)
    .post("/webhook")
    .set("Content-Type", "application/json")
    .set("X-Signature", signature)
    .set("X-Timestamp", timestamp)
    .set("X-Nonce", nonce)
    .send(raw);
}
