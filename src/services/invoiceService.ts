import { v4 as uuidv4 } from "uuid";
import { NotFoundError } from "../errors";
import type { CreateInvoiceDto } from "../schemas";
import { calculateFee } from "./fees";
import { Invoice } from "../types";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { MerchantRepository } from "../repositories/MerchantRepository";

export class InvoiceService {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly merchants: MerchantRepository,
  ) {}

  async create(
    dto: CreateInvoiceDto,
    idempotencyKey?: string,
  ): Promise<{ invoice: Invoice; duplicate: boolean }> {
    const merchant = await this.merchants.findById(dto.merchantId);
    if (!merchant) throw new NotFoundError("merchant not found");

    const { fee, amountToReceive } = calculateFee(
      dto.amount,
      merchant.feePercent,
    );

    return this.invoices.createIdempotent({
      merchantId: dto.merchantId,
      amount: dto.amount,
      currency: dto.currency,
      fee,
      amountToReceive,
      idempotencyKey: idempotencyKey ?? uuidv4(),
    });
  }

  async getById(id: string): Promise<Invoice> {
    const invoice = await this.invoices.findById(id);
    if (!invoice) throw new NotFoundError("invoice not found");
    return invoice;
  }
}
