import type { InvoiceStatus } from "./models/Invoice";

// Plain domain shapes — services never touch Mongoose documents directly.

export interface Invoice {
  id: string;
  merchantId: string;
  amount: number;
  currency: string;
  fee: number;
  amountToReceive: number;
  status: InvoiceStatus;
  idempotencyKey: string;
  credited: boolean;
}

export interface Merchant {
  id: string;
  name: string;
  feePercent: number;
  balance: number;
}

export interface NewInvoice {
  merchantId: string;
  amount: number;
  currency: string;
  fee: number;
  amountToReceive: number;
  idempotencyKey: string;
}

/** Minimal Redis surface needed for nonce dedup (keeps middleware decoupled from ioredis). */
export interface NonceStore {
  set(
    key: string,
    value: string,
    ex: "EX",
    ttl: number,
    nx: "NX",
  ): Promise<string | null>;
}
