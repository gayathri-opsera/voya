/**
 * CheckoutSaga — WO-048: Commit-or-compensate checkout saga.
 *
 * Implements a saga pattern that coordinates:
 *   1. Price re-validation (supplier)
 *   2. PaymentIntent creation (Stripe)
 *   3. Supplier reservation (reserve leg)
 *   4. Supplier confirmation (confirm leg)
 *   5. Booking status → CONFIRMED
 *
 * Each step has a compensating action that runs if a later step fails,
 * ensuring the system is never left in an inconsistent state.
 *
 * Steps are append-only — do not add backward edges.
 */

import {
  PriceRevalidationService,
  PriceChangedError,
} from "../domain/PriceRevalidationService.js";
import {
  BookingLifecycleService,
  BookingNotFoundError,
} from "../domain/BookingLifecycleService.js";

export type SagaOutcome =
  | { success: true; bookingId: string; paymentIntentId: string }
  | { success: false; reason: SagaFailureReason; step: string };

export type SagaFailureReason =
  | "PRICE_CHANGED"
  | "BOOKING_NOT_FOUND"
  | "SUPPLIER_RESERVE_FAILED"
  | "SUPPLIER_CONFIRM_FAILED"
  | "PAYMENT_FAILED"
  | "INTERNAL_ERROR";

export interface SagaPaymentPort {
  createPaymentIntent(input: {
    bookingId: string;
    amount: number;
    currency: string;
    userId: string;
    idempotencyKey: string;
  }): Promise<{ paymentIntentId: string; clientSecret: string }>;
  voidPaymentIntent(paymentIntentId: string): Promise<void>;
}

export interface SagaSupplierPort {
  reserve(input: {
    offerId: string;
    provenance: string;
    bookingId: string;
  }): Promise<{ reservationId: string }>;
  confirm(input: {
    reservationId: string;
    bookingId: string;
  }): Promise<void>;
  cancelReservation(reservationId: string): Promise<void>;
}

export interface SagaBookingPort {
  getBooking(bookingId: string): Promise<{
    id: string;
    ownerId: string;
    offerSnapshot: {
      offerId: string;
      provenance: string;
      amount: number;
      currency: string;
    };
  } | null>;
}

export class CheckoutSaga {
  constructor(
    private readonly priceRevalidation: PriceRevalidationService,
    private readonly paymentPort: SagaPaymentPort,
    private readonly supplierPort: SagaSupplierPort,
    private readonly bookingPort: SagaBookingPort,
    private readonly lifecycleService: BookingLifecycleService,
  ) {}

  async execute(input: {
    bookingId: string;
    userId: string;
    idempotencyKey: string;
  }): Promise<SagaOutcome> {
    let paymentIntentId: string | null = null;
    let reservationId: string | null = null;

    const booking = await this.bookingPort.getBooking(input.bookingId);
    if (!booking) {
      return { success: false, reason: "BOOKING_NOT_FOUND", step: "fetch_booking" };
    }

    const { offerSnapshot } = booking;

    // Step 1: Price re-validation
    try {
      await this.priceRevalidation.validate({
        offerId: offerSnapshot.offerId,
        provenance: offerSnapshot.provenance,
        snapshotPrice: offerSnapshot.amount,
        currency: offerSnapshot.currency,
      });
    } catch (err) {
      if (err instanceof PriceChangedError) {
        return { success: false, reason: "PRICE_CHANGED", step: "price_revalidation" };
      }
      return { success: false, reason: "INTERNAL_ERROR", step: "price_revalidation" };
    }

    // Step 2: PaymentIntent
    try {
      const payment = await this.paymentPort.createPaymentIntent({
        bookingId: input.bookingId,
        amount: offerSnapshot.amount,
        currency: offerSnapshot.currency,
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      });
      paymentIntentId = payment.paymentIntentId;
    } catch {
      return { success: false, reason: "PAYMENT_FAILED", step: "create_payment_intent" };
    }

    // Step 3: Supplier reserve
    try {
      const reservation = await this.supplierPort.reserve({
        offerId: offerSnapshot.offerId,
        provenance: offerSnapshot.provenance,
        bookingId: input.bookingId,
      });
      reservationId = reservation.reservationId;
    } catch {
      // Compensate: void payment intent
      if (paymentIntentId) await this.safeVoidPayment(paymentIntentId);
      return { success: false, reason: "SUPPLIER_RESERVE_FAILED", step: "supplier_reserve" };
    }

    // Step 4: Supplier confirm
    try {
      await this.supplierPort.confirm({
        reservationId,
        bookingId: input.bookingId,
      });
    } catch {
      // Compensate: cancel reservation + void payment
      await this.safeCancelReservation(reservationId);
      if (paymentIntentId) await this.safeVoidPayment(paymentIntentId);
      return { success: false, reason: "SUPPLIER_CONFIRM_FAILED", step: "supplier_confirm" };
    }

    // Step 5: Mark booking CONFIRMED
    await this.lifecycleService.transition(
      input.bookingId,
      "CONFIRMED",
      { id: input.userId, role: "system" },
      "checkout_saga",
    );

    return {
      success: true,
      bookingId: input.bookingId,
      paymentIntentId: paymentIntentId!,
    };
  }

  private async safeVoidPayment(intentId: string): Promise<void> {
    try { await this.paymentPort.voidPaymentIntent(intentId); } catch { /* best-effort */ }
  }

  private async safeCancelReservation(reservationId: string): Promise<void> {
    try { await this.supplierPort.cancelReservation(reservationId); } catch { /* best-effort */ }
  }
}
