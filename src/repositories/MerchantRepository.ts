import { MerchantModel, type MerchantDoc } from "../models/Merchant";
import type { Merchant } from "../types";

function toDomain(doc: MerchantDoc): Merchant {
  return {
    id: doc._id.toString(),
    name: doc.name,
    feePercent: doc.feePercent,
    balance: doc.balance,
  };
}

export class MerchantRepository {
  async findById(id: string): Promise<Merchant | null> {
    const doc = await MerchantModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async credit(id: string, amount: number): Promise<void> {
    await MerchantModel.updateOne({ _id: id }, { $inc: { balance: amount } });
  }
}
