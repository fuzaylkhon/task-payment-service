import { Schema, model, Types, type HydratedDocument } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type InvoiceStatus = 'pending' | 'paid' | 'failed';

export interface IInvoice {
  merchantId: Types.ObjectId;
  amount: number; // minor units - cents
  currency: string;
  fee: number;
  amountToReceive: number;
  status: InvoiceStatus;
  idempotencyKey: string;
  credited: boolean;
  paidAt?: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, uppercase: true },
    fee: { type: Number, required: true },
    amountToReceive: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    idempotencyKey: { type: String, default: uuidv4, unique: true, index: true },
    credited: { type: Boolean, default: false },
    paidAt: { type: Date },
  },
  { timestamps: true },
);

export const InvoiceModel = model<IInvoice>('Invoice', invoiceSchema);
export type InvoiceDoc = HydratedDocument<IInvoice>;
