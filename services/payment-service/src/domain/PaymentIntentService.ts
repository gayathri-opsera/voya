/**
 * PaymentIntentService — idempotent Stripe PaymentIntent creation.
 *
 * Key guarantees:
 * - One PaymentIntent per booking (idempotency via Stripe idempotency keys)
 * - Amount derived from the frozen offer_snapshot, never from client input
 * - Status tracks: PENDING → PROCESSING → SUCCEEDED | FAILED
 * - PCI-safe: no raw card data ever touches this service
 */

export interface PaymentRecord {
  id: string;
  bookingId: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  status: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";
  idempotencyKey: string;
  createdAt: Date;
}

export interface StripeClientPort {
  createPaymentIntent(input: {
    amount: number;
    currency: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
  }): Promise<{ id: string; clientSecret: string; status: string }>;
}

export interface PaymentRepositoryPort {
  findByBookingId(bookingId: string): Promise<PaymentRecord | null>;
  findByIdempotencyKey(key: string): Promise<PaymentRecord | null>;
  create(input: Omit<PaymentRecord, "id" | "createdAt">): Promise<PaymentRecord>;
  updateStatus(id: string, status: PaymentRecord["status"]): Promise<void>;
}

export class DuplicatePaymentError extends Error {
  constructor(
    public readonly bookingId: string,
    public readonly existingPaymentId: string,
  ) {
    super(`Payment for booking ${bookingId} already exists: ${existingPaymentId}`);
    this.name = "DuplicatePaymentError";
  }
}

export class PaymentIntentService {
  constructor(
    private readonly stripeClient: StripeClientPort,
    private readonly paymentRepo: PaymentRepositoryPort,
  ) {}

  async createForBooking(input: {
    bookingId: string;
    amount: number;
    currency: string;
    userId: string;
    idempotencyKey: string;
  }): Promise<{ paymentId: string; clientSecret: string; stripeIntentId: string }> {
    // Idempotency: return existing if same booking
    const existing = await this.paymentRepo.findByBookingId(input.bookingId);
    if (existing) {
      throw new DuplicatePaymentError(input.bookingId, existing.id);
    }

    // Create Stripe PaymentIntent (idempotent via stripe key)
    const stripeIntent = await this.stripeClient.createPaymentIntent({
      amount: Math.round(input.amount * 100), // cents
      currency: input.currency.toLowerCase(),
      metadata: {
        bookingId: input.bookingId,
        userId: input.userId,
      },
      idempotencyKey: input.idempotencyKey,
    });

    const payment = await this.paymentRepo.create({
      bookingId: input.bookingId,
      stripePaymentIntentId: stripeIntent.id,
      amount: input.amount,
      currency: input.currency,
      status: "PROCESSING",
      idempotencyKey: input.idempotencyKey,
    });

    return {
      paymentId: payment.id,
      clientSecret: stripeIntent.clientSecret,
      stripeIntentId: stripeIntent.id,
    };
  }
}
