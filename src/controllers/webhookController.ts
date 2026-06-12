import type { RequestHandler } from "express";
import type { PaymentService } from "../services/paymentService";
import { webhookBodySchema } from "../schemas";

export function makeWebhookController(service: PaymentService) {
  const handle: RequestHandler = async (req, res) => {
    const { invoiceId, status } = webhookBodySchema.parse(req.body);
    const result = await service.applyWebhook(invoiceId, status);

    switch (result.kind) {
      case "credited":
        res.json({ ok: true, status: "paid", credited: true });
        return;
      case "failed":
        res.json({ ok: true, status: "failed" });
        return;
      case "already_processed":
        res.json({ ok: true, status: result.status, credited: false });
        return;
    }
  };

  return { handle };
}
