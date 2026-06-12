import { Schema, model, type HydratedDocument } from "mongoose";

export interface IMerchant {
  name: string;
  feePercent: number; // e.g. 2.5 (%)
  balance: number; // minor units
}

const merchantSchema = new Schema<IMerchant>(
  {
    name: { type: String, required: true },
    feePercent: { type: Number, required: true, min: 0, max: 100 },
    balance: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const MerchantModel = model<IMerchant>("Merchant", merchantSchema);
export type MerchantDoc = HydratedDocument<IMerchant>;
