import type { Invoice } from "./types";

export function toInvoiceResponse(invoice: Invoice, duplicate?: boolean) {
  return {
    invoiceId: invoice.id,
    merchantId: invoice.merchantId,
    amount: invoice.amount,
    currency: invoice.currency,
    fee: invoice.fee,
    amountToReceive: invoice.amountToReceive,
    status: invoice.status,
    idempotencyKey: invoice.idempotencyKey,
    ...(duplicate !== undefined && { duplicate }),
  };
}

export function nowUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
