import { z } from "zod";
import { identifier, correlationId } from "../common/primitives.js";
import { BookingTypeSchema, BookingStatusSchema } from "../booking/index.js";
import { PaymentStatusSchema } from "../payment/index.js";

// ─── Base Event ───────────────────────────────────────────────────────────────

const BaseEventSchema = z.object({
  correlationId: correlationId,
  eventId: identifier,
  occurredAt: z.string().datetime({ message: "occurredAt must be a valid ISO-8601 datetime" }),
  version: z.literal("1.0"),
});

// ─── Booking Confirmation Event ───────────────────────────────────────────────

export const BookingConfirmationEventSchema = BaseEventSchema.extend({
  type: z.literal("booking.confirmed"),
  bookingId: identifier,
  bookingReference: z.string().min(1),
  userId: identifier,
  contactEmail: z.string().email(),
  bookingType: BookingTypeSchema,
  totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must have at most 2 decimal places"),
  currency: z.string().regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code"),
  expiresAt: z.string().datetime().optional(),
});
export type BookingConfirmationEvent = z.infer<typeof BookingConfirmationEventSchema>;

// ─── Booking Cancellation Event ───────────────────────────────────────────────

export const BookingCancellationEventSchema = BaseEventSchema.extend({
  type: z.literal("booking.cancelled"),
  bookingId: identifier,
  bookingReference: z.string().min(1),
  userId: identifier,
  contactEmail: z.string().email(),
  bookingType: BookingTypeSchema,
  reason: z.string().min(1).max(500),
  cancelledAt: z.string().datetime(),
  refundEligible: z.boolean(),
});
export type BookingCancellationEvent = z.infer<typeof BookingCancellationEventSchema>;

// ─── Notification Event ───────────────────────────────────────────────────────

export const NotificationChannelSchema = z.enum(["EMAIL", "SMS", "PUSH"], {
  errorMap: () => ({ message: "Channel must be one of: EMAIL, SMS, PUSH" }),
});
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export const NotificationEventSchema = BaseEventSchema.extend({
  type: z.literal("notification.send"),
  userId: identifier,
  channel: NotificationChannelSchema,
  templateId: z.string().min(1, "Template ID is required"),
  recipient: z.string().min(1, "Recipient is required"),
  payload: z.record(z.string(), z.unknown()),
  priority: z.enum(["HIGH", "NORMAL", "LOW"]).default("NORMAL"),
});
export type NotificationEvent = z.infer<typeof NotificationEventSchema>;

// ─── Payment Event ────────────────────────────────────────────────────────────

export const PaymentEventSchema = BaseEventSchema.extend({
  type: z.enum(["payment.completed", "payment.failed", "payment.refunded"]),
  paymentId: identifier,
  bookingId: identifier,
  userId: identifier,
  status: PaymentStatusSchema,
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must have at most 2 decimal places"),
  currency: z.string().regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code"),
});
export type PaymentEvent = z.infer<typeof PaymentEventSchema>;

// ─── Booking Status Changed Event ─────────────────────────────────────────────

export const BookingStatusChangedEventSchema = BaseEventSchema.extend({
  type: z.literal("booking.status_changed"),
  bookingId: identifier,
  userId: identifier,
  fromStatus: BookingStatusSchema,
  toStatus: BookingStatusSchema,
  actorId: identifier,
  reason: z.string().max(500).optional(),
});
export type BookingStatusChangedEvent = z.infer<typeof BookingStatusChangedEventSchema>;
