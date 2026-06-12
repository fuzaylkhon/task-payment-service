import { InvoiceModel, type InvoiceDoc } from "../models/Invoice";
import type { Invoice, NewInvoice } from "../types";

function toDomain(doc: InvoiceDoc): Invoice {
  return {
    id: doc._id.toString(),
    merchantId: doc.merchantId.toString(),
    amount: doc.amount,
    currency: doc.currency,
    fee: doc.fee,
    amountToReceive: doc.amountToReceive,
    status: doc.status,
    idempotencyKey: doc.idempotencyKey,
    credited: doc.credited,
  };
}

export class InvoiceRepository {
  async findById(id: string): Promise<Invoice | null> {
    const doc = await InvoiceModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async createIdempotent(
    data: NewInvoice,
  ): Promise<{ invoice: Invoice; duplicate: boolean }> {
    const existing = await InvoiceModel.findOne({
      idempotencyKey: data.idempotencyKey,
    });
    if (existing) return { invoice: toDomain(existing), duplicate: true };

    try {
      const doc = await InvoiceModel.create(data);
      return { invoice: toDomain(doc), duplicate: false };
    } catch (err) {
      // unique index race on idempotencyKey
      if (isDuplicateKeyError(err)) {
        const dup = await InvoiceModel.findOne({
          idempotencyKey: data.idempotencyKey,
        });
        if (dup) return { invoice: toDomain(dup), duplicate: true };
      }
      throw err;
    }
  }

  async markPaidIfPending(id: string): Promise<Invoice | null> {
    const doc = await InvoiceModel.findOneAndUpdate(
      { _id: id, status: "pending", credited: false },
      { status: "paid", credited: true, paidAt: new Date() },
      { new: true },
    );
    return doc ? toDomain(doc) : null;
  }

  async markFailedIfPending(id: string): Promise<boolean> {
    const res = await InvoiceModel.updateOne(
      { _id: id, status: "pending" },
      { status: "failed" },
    );
    return res.modifiedCount > 0;
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}
