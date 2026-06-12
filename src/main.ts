import express from "express";
import { Redis } from "ioredis";
import { config } from "./config";
import type { NonceStore } from "./types";
import { InvoiceRepository } from "./repositories/InvoiceRepository";
import { MerchantRepository } from "./repositories/MerchantRepository";
import { InvoiceService } from "./services/invoiceService";
import { PaymentService } from "./services/paymentService";
import { makeInvoiceController } from "./controllers/invoiceController";
import { makeWebhookController } from "./controllers/webhookController";
import { verifyWebhookSignature } from "./middleware/verifyWebhookSignature";
import { errorHandler } from "./middleware/errorHandler";
import mongoose from "mongoose";
import { fileURLToPath } from "url";

declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

export interface AppDeps {
  invoiceService: InvoiceService;
  paymentService: PaymentService;
  nonceStore: NonceStore;
  config: Pick<
    typeof config,
    "webhookSecret" | "timestampToleranceSec" | "nonceTtlSec"
  >;
}

export function createApp(deps: AppDeps): express.Express {
  const app = express();

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = buf.toString("utf8");
      },
    }),
  );

  const invoices = makeInvoiceController(deps.invoiceService);
  const webhook = makeWebhookController(deps.paymentService);

  app.post("/invoice", invoices.create);
  app.get("/invoice/:id", invoices.getById);
  app.post(
    "/webhook",
    verifyWebhookSignature({
      nonceStore: deps.nonceStore,
      secret: deps.config.webhookSecret,
      timestampToleranceSec: deps.config.timestampToleranceSec,
      nonceTtlSec: deps.config.nonceTtlSec,
    }),
    webhook.handle,
  );

  app.use(errorHandler);
  return app;
}

async function main(): Promise<void> {
  await mongoose.connect(config.mongoUri);
  const redis = new Redis(config.redisUrl);

  const invoiceRepo = new InvoiceRepository();
  const merchantRepo = new MerchantRepository();

  const app = createApp({
    invoiceService: new InvoiceService(invoiceRepo, merchantRepo),
    paymentService: new PaymentService(invoiceRepo, merchantRepo),
    nonceStore: redis,
    config,
  });

  app.listen(config.port, () => {
    console.log(`Payment service listening on :${config.port}`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
