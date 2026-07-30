import { z } from "zod";
import { identifier, positiveMoney, currencyCode } from "../common/primitives.js";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const PaymentStatusSchema = z.enum(
  ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"],
  {
    errorMap: () => ({
      message:
        "Payment status must be one of: PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED, PARTIALLY_REFUNDED",
    }),
  },
);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const PaymentMethodTypeSchema = z.enum(
  ["CARD", "BANK_TRANSFER", "WALLET"],
  {
    errorMap: () => ({
      message: "Payment method must be one of: CARD, BANK_TRANSFER, WALLET",
    }),
  },
);
export type PaymentMethodType = z.infer<typeof PaymentMethodTypeSchema>;

// ─── Payment Intent Request ───────────────────────────────────────────────────

export const PaymentIntentRequestSchema = z.object({
  bookingId: identifier,
  amount: positiveMoney,
  currency: currencyCode,
  paymentMethodType: PaymentMethodTypeSchema.default("CARD"),
  idempotencyKey: identifier,
  returnUrl: z.string().url("A valid return URL is required").optional(),
});
export type PaymentIntentRequest = z.infer<typeof PaymentIntentRequestSchema>;

// ─── Payment Intent Response ──────────────────────────────────────────────────

export const PaymentIntentResponseSchema = z.object({
  paymentIntentId: identifier,
  bookingId: identifier,
  status: PaymentStatusSchema,
  amount: positiveMoney,
  currency: currencyCode,
  clientSecret: z.string().optional(),
  redirectUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});
export type PaymentIntentResponse = z.infer<typeof PaymentIntentResponseSchema>;

// ─── Payment Record ───────────────────────────────────────────────────────────

export const PaymentRecordSchema = z.object({
  paymentId: identifier,
  paymentIntentId: identifier,
  bookingId: identifier,
  status: PaymentStatusSchema,
  amount: positiveMoney,
  currency: currencyCode,
  stripePaymentIntentId: z.string().optional(),
  receiptUrl: z.string().url().optional(),
  failureReason: z.string().optional(),
  processedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PaymentRecord = z.infer<typeof PaymentRecordSchema>;

// ─── Refund ───────────────────────────────────────────────────────────────────

export const RefundRequestSchema = z.object({
  bookingId: identifier,
  paymentId: identifier,
  amount: positiveMoney,
  currency: currencyCode,
  reason: z.string().trim().min(1, "Refund reason is required").max(500),
  idempotencyKey: identifier,
});
export type RefundRequest = z.infer<typeof RefundRequestSchema>;

export const RefundResponseSchema = z.object({
  refundId: identifier,
  paymentId: identifier,
  bookingId: identifier,
  status: PaymentStatusSchema,
  amount: positiveMoney,
  currency: currencyCode,
  processedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type RefundResponse = z.infer<typeof RefundResponseSchema>;
