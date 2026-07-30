import { describe, it, expect, beforeEach } from "vitest";
import {
  RefundService,
  RefundExceedsPaymentError,
  PaymentNotFoundError,
  type RefundRepositoryPort,
  type PaymentLedgerPort,
  type StripeRefundPort,
  type RefundRecord,
} from "../../src/domain/RefundService.js";

const PAYMENT = {
  id: "pay_001",
  bookingId: "b1",
  amount: 500,
  currency: "USD",
  stripePaymentIntentId: "pi_001",
  status: "SUCCEEDED",
};

function makeRefundRepo(): RefundRepositoryPort & { records: RefundRecord[] } {
  const records: RefundRecord[] = [];
  return {
    records,
    async findByPaymentId(paymentId) {
      return records.filter((r) => r.paymentId === paymentId);
    },
    async create(input) {
      const r: RefundRecord = { ...input, id: `ref_${records.length + 1}`, createdAt: new Date() };
      records.push(r);
      return r;
    },
    async updateStatus(id, status, stripeRefundId) {
      const r = records.find((r) => r.id === id);
      if (r) { r.status = status; if (stripeRefundId) r.stripeRefundId = stripeRefundId; }
    },
  };
}

function makeStripeRefund(fail = false): StripeRefundPort {
  return {
    async createRefund({ idempotencyKey }) {
      if (fail) throw new Error("stripe error");
      return { id: `re_${idempotencyKey}`, status: "succeeded" };
    },
  };
}

function makePaymentLedger(found = true): PaymentLedgerPort {
  return {
    async findByBookingId(bookingId) {
      return bookingId === "b1" && found ? PAYMENT : null;
    },
  };
}

describe("RefundService", () => {
  let repo: ReturnType<typeof makeRefundRepo>;
  let svc: RefundService;

  beforeEach(() => {
    repo = makeRefundRepo();
    svc = new RefundService(repo, makePaymentLedger(), makeStripeRefund());
  });

  it("creates a refund record with SUCCEEDED status", async () => {
    const result = await svc.refund({
      bookingId: "b1",
      amount: 100,
      reason: "traveler_request",
      idempotencyKey: "ik1",
    });
    expect(result.status).toBe("SUCCEEDED");
    expect(result.stripeRefundId).toBeDefined();
  });

  it("allows partial refund", async () => {
    await svc.refund({ bookingId: "b1", amount: 200, reason: "r", idempotencyKey: "ik2" });
    const result = await svc.refund({ bookingId: "b1", amount: 200, reason: "r", idempotencyKey: "ik3" });
    expect(result.status).toBe("SUCCEEDED");
  });

  it("throws RefundExceedsPaymentError when total exceeds payment", async () => {
    await svc.refund({ bookingId: "b1", amount: 400, reason: "r", idempotencyKey: "ik4" });
    await expect(
      svc.refund({ bookingId: "b1", amount: 200, reason: "r", idempotencyKey: "ik5" }),
    ).rejects.toThrow(RefundExceedsPaymentError);
  });

  it("throws PaymentNotFoundError when no payment exists", async () => {
    const svcNoPayment = new RefundService(repo, makePaymentLedger(false), makeStripeRefund());
    await expect(
      svcNoPayment.refund({ bookingId: "b1", amount: 50, reason: "r", idempotencyKey: "ik6" }),
    ).rejects.toThrow(PaymentNotFoundError);
  });

  it("marks refund as FAILED when Stripe errors", async () => {
    const svcFail = new RefundService(repo, makePaymentLedger(), makeStripeRefund(true));
    const result = await svcFail.refund({ bookingId: "b1", amount: 100, reason: "r", idempotencyKey: "ik7" });
    expect(result.status).toBe("FAILED");
  });
});
