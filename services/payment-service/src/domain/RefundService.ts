/**
 * RefundService — WO-049: Refunds through original payment route with split records.
 *
 * Rules:
 * - Refunds must go through the original payment method (no cash substitution)
 * - Partial refunds are supported (split records)
 * - Each refund creates a new RefundRecord linked to the original PaymentRecord
 * - Total refunds cannot exceed original payment amount
 * - Booking transitions to CANCELLED after full refund
 */

export type RefundStatus = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";

export interface RefundRecord {
  id: string;
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
  reason: string;
  status: RefundStatus;
  stripeRefundId: string | null;
  createdAt: Date;
}

export interface RefundRepositoryPort {
  findByPaymentId(paymentId: string): Promise<RefundRecord[]>;
  create(input: Omit<RefundRecord, "id" | "createdAt">): Promise<RefundRecord>;
  updateStatus(id: string, status: RefundStatus, stripeRefundId?: string): Promise<void>;
}

export interface PaymentLedgerPort {
  findByBookingId(bookingId: string): Promise<{
    id: string;
    amount: number;
    currency: string;
    stripePaymentIntentId: string;
    status: string;
  } | null>;
}

export interface StripeRefundPort {
  createRefund(input: {
    paymentIntentId: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<{ id: string; status: string }>;
}

export class RefundExceedsPaymentError extends Error {
  constructor(
    public readonly bookingId: string,
    public readonly requested: number,
    public readonly available: number,
  ) {
    super(
      `Refund of ${requested} exceeds available ${available} for booking ${bookingId}`,
    );
    this.name = "RefundExceedsPaymentError";
  }
}

export class PaymentNotFoundError extends Error {
  constructor(bookingId: string) {
    super(`No payment found for booking ${bookingId}`);
    this.name = "PaymentNotFoundError";
  }
}

export class RefundService {
  constructor(
    private readonly refundRepo: RefundRepositoryPort,
    private readonly paymentLedger: PaymentLedgerPort,
    private readonly stripeRefundPort: StripeRefundPort,
  ) {}

  async refund(input: {
    bookingId: string;
    amount: number;
    reason: string;
    idempotencyKey: string;
  }): Promise<RefundRecord> {
    const payment = await this.paymentLedger.findByBookingId(input.bookingId);
    if (!payment) throw new PaymentNotFoundError(input.bookingId);

    // Check cumulative refund limit
    const existing = await this.refundRepo.findByPaymentId(payment.id);
    const alreadyRefunded = existing
      .filter((r) => r.status === "SUCCEEDED" || r.status === "PROCESSING")
      .reduce((sum, r) => sum + r.amount, 0);

    const available = payment.amount - alreadyRefunded;
    if (input.amount > available) {
      throw new RefundExceedsPaymentError(input.bookingId, input.amount, available);
    }

    // Create ledger record first (optimistic)
    const refund = await this.refundRepo.create({
      paymentId: payment.id,
      bookingId: input.bookingId,
      amount: input.amount,
      currency: payment.currency,
      reason: input.reason,
      status: "PROCESSING",
      stripeRefundId: null,
    });

    // Issue refund via Stripe
    try {
      const stripeRefund = await this.stripeRefundPort.createRefund({
        paymentIntentId: payment.stripePaymentIntentId,
        amount: input.amount,
        idempotencyKey: input.idempotencyKey,
      });
      await this.refundRepo.updateStatus(refund.id, "SUCCEEDED", stripeRefund.id);
      return { ...refund, status: "SUCCEEDED", stripeRefundId: stripeRefund.id };
    } catch {
      await this.refundRepo.updateStatus(refund.id, "FAILED");
      return { ...refund, status: "FAILED" };
    }
  }

  async getRefundsForBooking(bookingId: string): Promise<RefundRecord[]> {
    const payment = await this.paymentLedger.findByBookingId(bookingId);
    if (!payment) return [];
    return this.refundRepo.findByPaymentId(payment.id);
  }
}
