import mongoose from "mongoose";
import { config } from "../src/config";
import { MerchantModel } from "../src/models/Merchant";

await mongoose.connect(config.mongoUri);
const merchant = await MerchantModel.create({
  name: "Demo Merchant",
  feePercent: 2.5,
});
console.log("Seeded merchant:", merchant.id);
await mongoose.disconnect();
