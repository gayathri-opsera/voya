/**
 * ReconciliationJob — WO-050: Daily payment-to-booking reconciliation.
 *
 * Runs daily to detect discrepancies between the payment ledger and booking states.
 * Reports are structured for alerting and compliance audit trails.
 *
 * Zero-exception policy: any booking with a SUCCEEDED payment should have
 * a corresponding CONFIRMED or COMPLETED booking. Any deviation is a discrepancy.
 */

export type DiscrepancyKind =
  | "PAYMENT_WITHOUT_BOOKING"
  | "BOOKING_CONFIRMED_NO_PAYMENT"
  | "PAYMENT_SUCCEEDED_BOOKING_CANCELLED"
  | "REFUND_SUM_EXCEEDS_PAYMENT"
  | "CURRENCY_MISMATCH";

export interface ReconciliationDiscrepancy {
  kind: DiscrepancyKind;
  bookingId: string | null;
  paymentId: string | null;
  details: string;
}

export interface ReconciliationReport {
  runAt: Date;
  checkedBookings: number;
  checkedPayments: number;
  discrepancies: ReconciliationDiscrepancy[];
  clean: boolean;
}

export interface BookingRow {
  id: string;
  status: string;
  currency: string;
  amount: number;
}

export interface PaymentRow {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: string;
}

export interface RefundRow {
  paymentId: string;
  amount: number;
  status: string;
}

export interface ReconciliationDataPort {
  getBookingsInWindow(from: Date, to: Date): Promise<BookingRow[]>;
  getPaymentsInWindow(from: Date, to: Date): Promise<PaymentRow[]>;
  getRefundsForPayments(paymentIds: string[]): Promise<RefundRow[]>;
}

export class ReconciliationJob {
  constructor(private readonly data: ReconciliationDataPort) {}

  async run(window: { from: Date; to: Date }): Promise<ReconciliationReport> {
    const runAt = new Date();
    const [bookings, payments] = await Promise.all([
      this.data.getBookingsInWindow(window.from, window.to),
      this.data.getPaymentsInWindow(window.from, window.to),
    ]);

    const paymentIds = payments.map((p) => p.id);
    const refunds = await this.data.getRefundsForPayments(paymentIds);

    const discrepancies: ReconciliationDiscrepancy[] = [];
    const bookingMap = new Map(bookings.map((b) => [b.id, b]));
    const paymentByBooking = new Map(payments.map((p) => [p.bookingId, p]));

    // Check: every SUCCEEDED payment should have a CONFIRMED/COMPLETED booking
    for (const payment of payments) {
      if (payment.status !== "SUCCEEDED") continue;
      const booking = bookingMap.get(payment.bookingId);
      if (!booking) {
        discrepancies.push({
          kind: "PAYMENT_WITHOUT_BOOKING",
          bookingId: payment.bookingId,
          paymentId: payment.id,
          details: `Payment ${payment.id} has no matching booking`,
        });
        continue;
      }
      if (booking.status === "CANCELLED") {
        discrepancies.push({
          kind: "PAYMENT_SUCCEEDED_BOOKING_CANCELLED",
          bookingId: booking.id,
          paymentId: payment.id,
          details: `Payment succeeded but booking is CANCELLED — refund may be pending`,
        });
      }
      if (booking.currency !== payment.currency) {
        discrepancies.push({
          kind: "CURRENCY_MISMATCH",
          bookingId: booking.id,
          paymentId: payment.id,
          details: `Booking currency ${booking.currency} differs from payment currency ${payment.currency}`,
        });
      }
    }

    // Check: every CONFIRMED booking should have a payment
    for (const booking of bookings) {
      if (!["CONFIRMED", "COMPLETED"].includes(booking.status)) continue;
      const payment = paymentByBooking.get(booking.id);
      if (!payment) {
        discrepancies.push({
          kind: "BOOKING_CONFIRMED_NO_PAYMENT",
          bookingId: booking.id,
          paymentId: null,
          details: `Booking ${booking.id} is ${booking.status} but has no payment record`,
        });
      }
    }

    // Check: refund totals
    const refundByPayment = new Map<string, number>();
    for (const refund of refunds) {
      if (refund.status === "SUCCEEDED") {
        refundByPayment.set(refund.paymentId, (refundByPayment.get(refund.paymentId) ?? 0) + refund.amount);
      }
    }
    for (const payment of payments) {
      const totalRefunded = refundByPayment.get(payment.id) ?? 0;
      if (totalRefunded > payment.amount) {
        discrepancies.push({
          kind: "REFUND_SUM_EXCEEDS_PAYMENT",
          bookingId: payment.bookingId,
          paymentId: payment.id,
          details: `Total refunds ${totalRefunded} exceed payment amount ${payment.amount}`,
        });
      }
    }

    return {
      runAt,
      checkedBookings: bookings.length,
      checkedPayments: payments.length,
      discrepancies,
      clean: discrepancies.length === 0,
    };
  }
}
