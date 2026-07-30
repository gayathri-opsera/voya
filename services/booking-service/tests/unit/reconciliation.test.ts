import { describe, it, expect, beforeEach } from "vitest";
import {
  ReconciliationJob,
  type ReconciliationDataPort,
  type BookingRow,
  type PaymentRow,
  type RefundRow,
} from "../../src/reconciliation/ReconciliationJob.js";

function makeDataPort(overrides: Partial<{
  bookings: BookingRow[];
  payments: PaymentRow[];
  refunds: RefundRow[];
}>): ReconciliationDataPort {
  return {
    async getBookingsInWindow() { return overrides.bookings ?? []; },
    async getPaymentsInWindow() { return overrides.payments ?? []; },
    async getRefundsForPayments() { return overrides.refunds ?? []; },
  };
}

const WINDOW = { from: new Date("2026-01-01"), to: new Date("2026-01-31") };

describe("ReconciliationJob", () => {
  it("returns clean report when everything matches", async () => {
    const job = new ReconciliationJob(makeDataPort({
      bookings: [{ id: "b1", status: "CONFIRMED", currency: "USD", amount: 300 }],
      payments: [{ id: "pay_1", bookingId: "b1", amount: 300, currency: "USD", status: "SUCCEEDED" }],
    }));
    const report = await job.run(WINDOW);
    expect(report.clean).toBe(true);
    expect(report.discrepancies).toHaveLength(0);
  });

  it("detects PAYMENT_WITHOUT_BOOKING", async () => {
    const job = new ReconciliationJob(makeDataPort({
      bookings: [],
      payments: [{ id: "pay_1", bookingId: "b_missing", amount: 100, currency: "USD", status: "SUCCEEDED" }],
    }));
    const report = await job.run(WINDOW);
    expect(report.discrepancies).toHaveLength(1);
    expect(report.discrepancies[0].kind).toBe("PAYMENT_WITHOUT_BOOKING");
  });

  it("detects BOOKING_CONFIRMED_NO_PAYMENT", async () => {
    const job = new ReconciliationJob(makeDataPort({
      bookings: [{ id: "b1", status: "CONFIRMED", currency: "USD", amount: 300 }],
      payments: [],
    }));
    const report = await job.run(WINDOW);
    expect(report.discrepancies.some((d) => d.kind === "BOOKING_CONFIRMED_NO_PAYMENT")).toBe(true);
  });

  it("detects PAYMENT_SUCCEEDED_BOOKING_CANCELLED", async () => {
    const job = new ReconciliationJob(makeDataPort({
      bookings: [{ id: "b1", status: "CANCELLED", currency: "USD", amount: 300 }],
      payments: [{ id: "pay_1", bookingId: "b1", amount: 300, currency: "USD", status: "SUCCEEDED" }],
    }));
    const report = await job.run(WINDOW);
    expect(report.discrepancies.some((d) => d.kind === "PAYMENT_SUCCEEDED_BOOKING_CANCELLED")).toBe(true);
  });

  it("detects CURRENCY_MISMATCH", async () => {
    const job = new ReconciliationJob(makeDataPort({
      bookings: [{ id: "b1", status: "CONFIRMED", currency: "EUR", amount: 300 }],
      payments: [{ id: "pay_1", bookingId: "b1", amount: 300, currency: "USD", status: "SUCCEEDED" }],
    }));
    const report = await job.run(WINDOW);
    expect(report.discrepancies.some((d) => d.kind === "CURRENCY_MISMATCH")).toBe(true);
  });

  it("detects REFUND_SUM_EXCEEDS_PAYMENT", async () => {
    const job = new ReconciliationJob(makeDataPort({
      bookings: [{ id: "b1", status: "CANCELLED", currency: "USD", amount: 100 }],
      payments: [{ id: "pay_1", bookingId: "b1", amount: 100, currency: "USD", status: "SUCCEEDED" }],
      refunds: [
        { paymentId: "pay_1", amount: 80, status: "SUCCEEDED" },
        { paymentId: "pay_1", amount: 50, status: "SUCCEEDED" }, // total 130 > 100
      ],
    }));
    const report = await job.run(WINDOW);
    expect(report.discrepancies.some((d) => d.kind === "REFUND_SUM_EXCEEDS_PAYMENT")).toBe(true);
  });
});
