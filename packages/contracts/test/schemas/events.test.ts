import { describe, it, expect } from "vitest";
import {
  BookingConfirmationEventSchema,
  BookingCancellationEventSchema,
  NotificationEventSchema,
} from "../../src/events/index.js";
import {
  rawBookingConfirmationEvent,
  rawBookingCancellationEvent,
  rawNotificationEvent,
  invalidEventPayloads,
} from "../fixtures/events.js";

describe("BookingConfirmationEventSchema", () => {
  it("parses a valid booking confirmation event", () => {
    const result = BookingConfirmationEventSchema.safeParse(rawBookingConfirmationEvent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.correlationId).toBe("corr_01J9X0Y2Z3A4B5C6D7E8F9G0");
      expect(result.data.type).toBe("booking.confirmed");
      expect(result.data.bookingType).toBe("FLIGHT");
    }
  });

  it("rejects when correlationId is missing", () => {
    const result = BookingConfirmationEventSchema.safeParse(
      invalidEventPayloads.missingCorrelationId,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("correlationId"));
      expect(issue).toBeDefined();
    }
  });

  it("rejects when correlationId is empty string", () => {
    const result = BookingConfirmationEventSchema.safeParse(
      invalidEventPayloads.emptyCorrelationId,
    );
    expect(result.success).toBe(false);
  });

  it("rejects when correlationId exceeds 64 characters", () => {
    const result = BookingConfirmationEventSchema.safeParse(
      invalidEventPayloads.tooLongCorrelationId,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("correlationId"));
      expect(issue?.message).toMatch(/64 characters/i);
    }
  });
});

describe("BookingCancellationEventSchema", () => {
  it("parses a valid booking cancellation event", () => {
    const result = BookingCancellationEventSchema.safeParse(rawBookingCancellationEvent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("booking.cancelled");
      expect(result.data.refundEligible).toBe(true);
      expect(result.data.correlationId).toBeDefined();
    }
  });

  it("rejects an empty cancellation reason", () => {
    const result = BookingCancellationEventSchema.safeParse({
      ...rawBookingCancellationEvent,
      reason: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("reason"));
      expect(issue).toBeDefined();
    }
  });
});

describe("NotificationEventSchema", () => {
  it("parses a valid notification event", () => {
    const result = NotificationEventSchema.safeParse(rawNotificationEvent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("notification.send");
      expect(result.data.channel).toBe("EMAIL");
      expect(result.data.correlationId).toBe("corr_01J9X0Y2Z3A4B5C6D7E8F9G0");
      expect(result.data.priority).toBe("NORMAL");
    }
  });

  it("defaults priority to NORMAL when not provided", () => {
    const { priority: _skip, ...withoutPriority } = rawNotificationEvent;
    const result = NotificationEventSchema.safeParse(withoutPriority);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe("NORMAL");
    }
  });

  it("rejects an invalid notification channel", () => {
    const result = NotificationEventSchema.safeParse({
      ...rawNotificationEvent,
      channel: "TELEGRAM",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("channel"));
      expect(issue?.message).toMatch(/EMAIL|SMS|PUSH/i);
    }
  });
});
