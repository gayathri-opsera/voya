import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CheckoutSaga,
  type SagaPaymentPort,
  type SagaSupplierPort,
  type SagaBookingPort,
} from "../../src/saga/CheckoutSaga.js";
import {
  PriceRevalidationService,
} from "../../src/domain/PriceRevalidationService.js";
import {
  BookingLifecycleService,
} from "../../src/domain/BookingLifecycleService.js";
import { InMemoryAuditStore, AuditWriter } from "../../src/domain/AuditWriter.js";

function makeLivePrice(amount: number) {
  return { getLivePrice: async () => ({ amount, currency: "USD" }) };
}

const BOOKING = {
  id: "b1",
  ownerId: "u1",
  offerSnapshot: { offerId: "off1", provenance: "AMADEUS", amount: 300, currency: "USD" },
};

function makePaymentPort(fail = false): SagaPaymentPort {
  return {
    async createPaymentIntent() {
      if (fail) throw new Error("stripe error");
      return { paymentIntentId: "pi_001", clientSecret: "secret" };
    },
    async voidPaymentIntent() {},
  };
}

function makeSupplierPort(
  opts: { reserveFail?: boolean; confirmFail?: boolean } = {},
): SagaSupplierPort {
  return {
    async reserve() {
      if (opts.reserveFail) throw new Error("reserve failed");
      return { reservationId: "res_001" };
    },
    async confirm() {
      if (opts.confirmFail) throw new Error("confirm failed");
    },
    async cancelReservation() {},
  };
}

const bookingPort: SagaBookingPort = {
  async getBooking(id) {
    if (id === "b1") return BOOKING;
    return null;
  },
};

function makeLifecycle(): BookingLifecycleService {
  const store = new Map<string, { id: string; status: string }>([["b1", { id: "b1", status: "PENDING" }]]);
  const repo = {
    async findById(id: string) { const r = store.get(id); return r ? { id: r.id, status: r.status as import("../../src/domain/transitions.js").BookingStatus } : null; },
    async conditionalStatusUpdate(id: string, expectedFrom: string, to: string) {
      const booking = store.get(id);
      if (!booking || booking.status !== expectedFrom) return null;
      const updated = { id: booking.id, status: to as import("../../src/domain/transitions.js").BookingStatus };
      store.set(id, updated);
      return updated;
    },
  };
  return new BookingLifecycleService(repo, new AuditWriter(new InMemoryAuditStore()));
}

describe("CheckoutSaga", () => {
  it("happy path: all steps succeed", async () => {
    const saga = new CheckoutSaga(
      new PriceRevalidationService(makeLivePrice(300)),
      makePaymentPort(),
      makeSupplierPort(),
      bookingPort,
      makeLifecycle(),
    );
    const result = await saga.execute({ bookingId: "b1", userId: "u1", idempotencyKey: "ik1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.bookingId).toBe("b1");
      expect(result.paymentIntentId).toBe("pi_001");
    }
  });

  it("returns PRICE_CHANGED when price increases beyond tolerance", async () => {
    const saga = new CheckoutSaga(
      new PriceRevalidationService(makeLivePrice(400)),
      makePaymentPort(),
      makeSupplierPort(),
      bookingPort,
      makeLifecycle(),
    );
    const result = await saga.execute({ bookingId: "b1", userId: "u1", idempotencyKey: "ik2" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("PRICE_CHANGED");
  });

  it("returns BOOKING_NOT_FOUND for unknown booking", async () => {
    const saga = new CheckoutSaga(
      new PriceRevalidationService(makeLivePrice(300)),
      makePaymentPort(),
      makeSupplierPort(),
      bookingPort,
      makeLifecycle(),
    );
    const result = await saga.execute({ bookingId: "unknown", userId: "u1", idempotencyKey: "ik3" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("BOOKING_NOT_FOUND");
  });

  it("returns SUPPLIER_RESERVE_FAILED and voids payment on reserve failure", async () => {
    const voidCalled: string[] = [];
    const paymentPort: SagaPaymentPort = {
      async createPaymentIntent() { return { paymentIntentId: "pi_002", clientSecret: "s" }; },
      async voidPaymentIntent(id) { voidCalled.push(id); },
    };
    const saga = new CheckoutSaga(
      new PriceRevalidationService(makeLivePrice(300)),
      paymentPort,
      makeSupplierPort({ reserveFail: true }),
      bookingPort,
      makeLifecycle(),
    );
    const result = await saga.execute({ bookingId: "b1", userId: "u1", idempotencyKey: "ik4" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("SUPPLIER_RESERVE_FAILED");
    expect(voidCalled).toContain("pi_002");
  });
});
