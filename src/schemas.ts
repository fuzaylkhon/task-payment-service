import { z } from 'zod';
import { isValidObjectId } from 'mongoose';

const objectId = z.string().refine(isValidObjectId, 'must be a valid ObjectId');

export const createInvoiceSchema = z.object({
  amount: z.number().int('amount must be an integer (minor units)').positive(),
  currency: z.string().length(3).transform((s) => s.toUpperCase()),
  merchantId: objectId,
});

export const webhookBodySchema = z.object({
  invoiceId: objectId,
  status: z.enum(['paid', 'failed']),
});

export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;
export type WebhookBodyDto = z.infer<typeof webhookBodySchema>;
