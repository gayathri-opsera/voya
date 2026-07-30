export const rawBookingConfirmationEvent = {
  correlationId: "corr_01J9X0Y2Z3A4B5C6D7E8F9G0",
  eventId: "evt_01J9X0Y2Z3A4B5C6D7E8F9G0H1",
  occurredAt: "2099-06-15T20:01:00.000Z",
  version: "1.0" as const,
  type: "booking.confirmed" as const,
  bookingId: "book_01J9X0Y2Z3A4B5C6D7E8F9G0H3",
  bookingReference: "VOYA-ABC123",
  userId: "usr_01J9X0Y2Z3A4B5C6D7E8F9G0",
  contactEmail: "jane.doe@example.com",
  bookingType: "FLIGHT" as const,
  totalAmount: "450.00",
  currency: "USD",
  expiresAt: "2099-06-15T21:00:00.000Z",
};

export const rawBookingCancellationEvent = {
  correlationId: "corr_01J9X0Y2Z3A4B5C6D7E8F9G0",
  eventId: "evt_01J9X0Y2Z3A4B5C6D7E8F9G0H2",
  occurredAt: "2099-06-15T21:00:00.000Z",
  version: "1.0" as const,
  type: "booking.cancelled" as const,
  bookingId: "book_01J9X0Y2Z3A4B5C6D7E8F9G0H3",
  bookingReference: "VOYA-ABC123",
  userId: "usr_01J9X0Y2Z3A4B5C6D7E8F9G0",
  contactEmail: "jane.doe@example.com",
  bookingType: "FLIGHT" as const,
  reason: "Customer requested cancellation",
  cancelledAt: "2099-06-15T21:00:00.000Z",
  refundEligible: true,
};

export const rawNotificationEvent = {
  correlationId: "corr_01J9X0Y2Z3A4B5C6D7E8F9G0",
  eventId: "evt_01J9X0Y2Z3A4B5C6D7E8F9G0H3",
  occurredAt: "2099-06-15T20:01:00.000Z",
  version: "1.0" as const,
  type: "notification.send" as const,
  userId: "usr_01J9X0Y2Z3A4B5C6D7E8F9G0",
  channel: "EMAIL" as const,
  templateId: "booking-confirmation",
  recipient: "jane.doe@example.com",
  payload: {
    bookingReference: "VOYA-ABC123",
    totalAmount: "450.00",
    currency: "USD",
  },
  priority: "NORMAL" as const,
};

export const invalidEventPayloads = {
  missingCorrelationId: {
    ...rawBookingConfirmationEvent,
    correlationId: undefined,
  },
  emptyCorrelationId: {
    ...rawBookingConfirmationEvent,
    correlationId: "",
  },
  tooLongCorrelationId: {
    ...rawBookingConfirmationEvent,
    correlationId: "a".repeat(65),
  },
};
