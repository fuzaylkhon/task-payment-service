import { describe, test, expect, beforeEach } from "vitest";
import { PaymentService } from "../src/services/paymentService";
import { NotFoundError } from "../src/errors";
import {
  InMemoryInvoiceRepository,
  InMemoryMerchantRepository,
} from "./helpers/inMemoryRepos";
import type { Invoice, Merchant } from "../src/types";

let invoices: InMemoryInvoiceRepository;
let merchants: InMemoryMerchantRepository;
let service: PaymentService;
let merchant: Merchant;
let invoice: Invoice;

beforeEach(async () => {
  invoices = new InMemoryInvoiceRepository();
  merchants = new InMemoryMerchantRepository();
  service = new PaymentService(invoices, merchants);

  merchant = merchants.add({ name: "M", feePercent: 2.5, balance: 0 });
  ({ invoice } = await invoices.createIdempotent({
    merchantId: merchant.id,
    amount: 10000,
    currency: "USD",
    fee: 250,
    amountToReceive: 9750,
    idempotencyKey: "k1",
  }));
});

describe("PaymentService.applyWebhook", () => {
  test("paid credits merchant exactly once", async () => {
    const first = await service.applyWebhook(invoice.id, "paid");
    const second = await service.applyWebhook(invoice.id, "paid");

    expect(first).toEqual({ kind: "credited" });
    expect(second).toEqual({ kind: "already_processed", status: "paid" });
    expect(merchant.balance).toBe(9750);
  });

  test("failed marks invoice without crediting", async () => {
    const result = await service.applyWebhook(invoice.id, "failed");
    expect(result).toEqual({ kind: "failed" });
    expect((await invoices.findById(invoice.id))?.status).toBe("failed");
    expect(merchant.balance).toBe(0);
  });

  test("paid after failed does not credit", async () => {
    await service.applyWebhook(invoice.id, "failed");
    const result = await service.applyWebhook(invoice.id, "paid");
    expect(result).toEqual({ kind: "already_processed", status: "failed" });
    expect(merchant.balance).toBe(0);
  });

  test("unknown invoice throws NotFoundError", async () => {
    await expect(
      service.applyWebhook("64b000000000000000000000", "paid"),
    ).rejects.toThrow(NotFoundError);
  });

  test("concurrent paid webhooks credit once", async () => {
    const results = await Promise.all([
      service.applyWebhook(invoice.id, "paid"),
      service.applyWebhook(invoice.id, "paid"),
      service.applyWebhook(invoice.id, "paid"),
    ]);
    const credited = results.filter((r) => r.kind === "credited");
    expect(credited).toHaveLength(1);
    expect(merchant.balance).toBe(9750);
  });
});
