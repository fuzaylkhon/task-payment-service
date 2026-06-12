import type { RequestHandler } from "express";
import type { InvoiceService } from "../services/invoiceService";
import { createInvoiceSchema } from "../schemas";
import { toInvoiceResponse } from "../utils";

export function makeInvoiceController(service: InvoiceService) {
  const create: RequestHandler = async (req, res) => {
    const dto = createInvoiceSchema.parse(req.body);
    const idempotencyKey = req.get("Idempotency-Key") ?? undefined;

    const { invoice, duplicate } = await service.create(dto, idempotencyKey);
    res.status(duplicate ? 200 : 201).json(toInvoiceResponse(invoice, duplicate));
  };

  const getById: RequestHandler = async (req, res) => {
    const invoice = await service.getById(req.params.id as string);
    res.json(toInvoiceResponse(invoice));
  };

  return { create, getById };
}
