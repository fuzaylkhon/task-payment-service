import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { InvoiceRepository } from "../src/repositories/InvoiceRepository";
import { MerchantRepository } from "../src/repositories/MerchantRepository";
import { MerchantModel } from "../src/models/Merchant";
import { InvoiceModel } from "../src/models/Invoice";

let mongod: MongoMemoryServer | undefined;
const invoices = new InvoiceRepository();
const merchants = new MerchantRepository();

beforeAll(async () => {
  if (process.env.TEST_MONGO_URI) {
    await mongoose.connect(process.env.TEST_MONGO_URI);
  } else {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await InvoiceModel.deleteMany({});
  await MerchantModel.deleteMany({});
});

async function seedInvoice() {
  const merchant = await MerchantModel.create({ name: "M", feePercent: 2.5 });
  const { invoice } = await invoices.createIdempotent({
    merchantId: merchant.id,
    amount: 10000,
    currency: "USD",
    fee: 250,
    amountToReceive: 9750,
    idempotencyKey: "seed-key",
  });
  return { merchant, invoice };
}

describe("InvoiceRepository", () => {
  test("createIdempotent returns existing invoice for duplicate key", async () => {
    const merchant = await MerchantModel.create({ name: "M", feePercent: 1 });
    const data = {
      merchantId: merchant.id,
      amount: 100,
      currency: "USD",
      fee: 1,
      amountToReceive: 99,
      idempotencyKey: "dup-key",
    };
    const first = await invoices.createIdempotent(data);
    const second = await invoices.createIdempotent(data);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.invoice.id).toBe(first.invoice.id);
    expect(await InvoiceModel.countDocuments()).toBe(1);
  });

  test("markPaidIfPending transitions exactly once", async () => {
    const { invoice } = await seedInvoice();

    const first = await invoices.markPaidIfPending(invoice.id);
    const second = await invoices.markPaidIfPending(invoice.id);

    expect(first?.status).toBe("paid");
    expect(second).toBeNull();
  });

  test("markFailedIfPending does not downgrade paid invoice", async () => {
    const { invoice } = await seedInvoice();
    await invoices.markPaidIfPending(invoice.id);

    expect(await invoices.markFailedIfPending(invoice.id)).toBe(false);
    expect((await invoices.findById(invoice.id))?.status).toBe("paid");
  });
});

describe("MerchantRepository", () => {
  test("credit increments balance atomically", async () => {
    const { merchant } = await seedInvoice();
    await merchants.credit(merchant.id, 9750);
    await merchants.credit(merchant.id, 250);

    expect((await merchants.findById(merchant.id))?.balance).toBe(10000);
  });
});
