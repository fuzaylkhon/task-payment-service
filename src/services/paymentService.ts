import { NotFoundError } from "../errors";
import type { InvoiceStatus } from "../models/Invoice";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { MerchantRepository } from "../repositories/MerchantRepository";

export type WebhookResult =
  | { kind: "credited" }
  | { kind: "failed" }
  | { kind: "already_processed"; status: InvoiceStatus };

export class PaymentService {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly merchants: MerchantRepository,
  ) {}

  async applyWebhook(
    invoiceId: string,
    status: "paid" | "failed",
  ): Promise<WebhookResult> {
    const invoice = await this.invoices.findById(invoiceId);
    if (!invoice) throw new NotFoundError("invoice not found");

    if (status === "failed") {
      const changed = await this.invoices.markFailedIfPending(invoiceId);
      return changed
        ? { kind: "failed" }
        : { kind: "already_processed", status: invoice.status };
    }

    // 'paid': atomic pending -> paid transition guarantees the credit happens exactly once
    const updated = await this.invoices.markPaidIfPending(invoiceId);
    if (!updated) return { kind: "already_processed", status: invoice.status };

    await this.merchants.credit(updated.merchantId, updated.amountToReceive);
    return { kind: "credited" };
  }
}
