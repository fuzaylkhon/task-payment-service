import { Types } from "mongoose";
import type { Invoice, Merchant, NewInvoice } from "../../src/types";

export class InMemoryInvoiceRepository {
  readonly items = new Map<string, Invoice>();

  async findById(id: string): Promise<Invoice | null> {
    return this.items.get(id) ?? null;
  }

  async createIdempotent(
    data: NewInvoice,
  ): Promise<{ invoice: Invoice; duplicate: boolean }> {
    for (const inv of this.items.values()) {
      if (inv.idempotencyKey === data.idempotencyKey)
        return { invoice: inv, duplicate: true };
    }
    const invoice: Invoice = {
      id: new Types.ObjectId().toString(),
      status: "pending",
      credited: false,
      ...data,
    };
    this.items.set(invoice.id, invoice);
    return { invoice, duplicate: false };
  }

  async markPaidIfPending(id: string): Promise<Invoice | null> {
    const inv = this.items.get(id);
    if (!inv || inv.status !== "pending" || inv.credited) return null;
    inv.status = "paid";
    inv.credited = true;
    return inv;
  }

  async markFailedIfPending(id: string): Promise<boolean> {
    const inv = this.items.get(id);
    if (!inv || inv.status !== "pending") return false;
    inv.status = "failed";
    return true;
  }
}

export class InMemoryMerchantRepository {
  readonly items = new Map<string, Merchant>();

  add(data: Omit<Merchant, "id">): Merchant {
    const merchant: Merchant = { id: new Types.ObjectId().toString(), ...data };
    this.items.set(merchant.id, merchant);
    return merchant;
  }

  async findById(id: string): Promise<Merchant | null> {
    return this.items.get(id) ?? null;
  }

  async credit(id: string, amount: number): Promise<void> {
    const m = this.items.get(id);
    if (m) m.balance += amount;
  }
}
