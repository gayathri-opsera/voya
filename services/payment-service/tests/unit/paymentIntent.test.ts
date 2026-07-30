import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  PaymentIntentService,
  DuplicatePaymentError,
  type StripeClientPort,
  type PaymentRepositoryPort,
  type PaymentRecord,
} from "../../src/domain/PaymentIntentService.js";

class InMemoryPaymentRepo implements PaymentRepositoryPort {
  private store = new Map<string, PaymentRecord>();
  private bookingIndex = new Map<string, string>();
  private idempotencyIndex = new Map<string, string>();
  private nextId = 1;

  async findByBookingId(bookingId: string): Promise<PaymentRecord | null> {
    const id = this.bookingIndex.get(bookingId);
    return id ? (this.store.get(id) ?? null) : null;
  }

  async findByIdempotencyKey(key: string): Promise<PaymentRecord | null> {
    const id = this.idempotencyIndex.get(key);
    return id ? (this.store.get(id) ?? null) : null;
  }

  async create(input: Omit<PaymentRecord, "id" | "createdAt">): Promise<PaymentRecord> {
    const id = `pay_${this.nextId++}`;
    const record: PaymentRecord = { ...input, id, createdAt: new Date() };
    this.store.set(id, record);
    this.bookingIndex.set(input.bookingId, id);
    this.idempotencyIndex.set(input.idempotencyKey, id);
    return record;
  }

  async updateStatus(id: string, status: PaymentRecord["status"]): Promise<void> {
    const existing = this.store.get(id);
    if (existing) this.store.set(id, { ...existing, status });
  }
}

const mockStripe: StripeClientPort = {
  async createPaymentIntent({ idempotencyKey }) {
    return {
      id: `pi_${idempotencyKey}`,
      clientSecret: `pi_${idempotencyKey}_secret`,
      status: "requires_payment_method",
    };
  },
};

describe("PaymentIntentService", () => {
  let svc: PaymentIntentService;
  let repo: InMemoryPaymentRepo;

  beforeEach(() => {
    repo = new InMemoryPaymentRepo();
    svc = new PaymentIntentService(mockStripe, repo);
  });

  it("creates a PaymentIntent and returns clientSecret", async () => {
    const result = await svc.createForBooking({
      bookingId: "b1",
      amount: 342.50,
      currency: "USD",
      userId: "u1",
      idempotencyKey: "idem_001",
    });

    expect(result.paymentId).toMatch(/pay_/);
    expect(result.clientSecret).toContain("_secret");
    expect(result.stripeIntentId).toContain("pi_");
  });

  it("stores payment with PROCESSING status", async () => {
    await svc.createForBooking({
      bookingId: "b2",
      amount: 100,
      currency: "EUR",
      userId: "u1",
      idempotencyKey: "idem_002",
    });

    const payment = await repo.findByBookingId("b2");
    expect(payment?.status).toBe("PROCESSING");
    expect(payment?.amount).toBe(100);
  });

  it("throws DuplicatePaymentError for same bookingId", async () => {
    await svc.createForBooking({
      bookingId: "b3",
      amount: 50,
      currency: "USD",
      userId: "u1",
      idempotencyKey: "idem_003",
    });

    await expect(
      svc.createForBooking({
        bookingId: "b3",
        amount: 50,
        currency: "USD",
        userId: "u1",
        idempotencyKey: "idem_003b",
      }),
    ).rejects.toThrow(DuplicatePaymentError);
  });
});
