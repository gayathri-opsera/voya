import { describe, it, expect, beforeEach } from "vitest";
import {
  NotificationConsumer,
  type SesPort,
  type NotificationIdempotencyStore,
  type NotificationTemplate,
  type NotificationEventType,
} from "../../src/domain/NotificationConsumer.js";

class InMemoryIdempotencyStore implements NotificationIdempotencyStore {
  private readonly processed = new Set<string>();
  async markProcessed(key: string) {
    if (this.processed.has(key)) return { alreadyProcessed: true };
    this.processed.add(key);
    return { alreadyProcessed: false };
  }
}

class MockSes implements SesPort {
  readonly sent: Array<{ to: string; subject: string; idempotencyKey: string }> = [];
  async send(email: { to: string; subject: string; htmlBody: string; textBody: string; idempotencyKey: string }) {
    this.sent.push({ to: email.to, subject: email.subject, idempotencyKey: email.idempotencyKey });
    return { messageId: `msg_${this.sent.length}` };
  }
}

const confirmationTemplate: NotificationTemplate = {
  render(data: unknown) {
    const d = data as { email: string; bookingId: string };
    return {
      to: d.email,
      subject: "Your booking is confirmed",
      htmlBody: `<p>Booking ${d.bookingId} is confirmed</p>`,
      textBody: `Booking ${d.bookingId} is confirmed`,
    };
  },
};

describe("NotificationConsumer — exactly-once SES delivery", () => {
  let ses: MockSes;
  let store: InMemoryIdempotencyStore;
  let consumer: NotificationConsumer;

  beforeEach(() => {
    ses = new MockSes();
    store = new InMemoryIdempotencyStore();
    consumer = new NotificationConsumer(ses, store, {
      "booking.confirmed": confirmationTemplate,
    });
  });

  it("sends email and returns sent outcome", async () => {
    const result = await consumer.processEvent({
      eventType: "booking.confirmed",
      messageId: "msg_001",
      correlationId: "corr_001",
      payload: { email: "user@example.com", bookingId: "b1" },
    });
    expect(result.outcome).toBe("sent");
    expect(ses.sent).toHaveLength(1);
    expect(ses.sent[0].to).toBe("user@example.com");
  });

  it("returns duplicate for same messageId (exactly-once)", async () => {
    await consumer.processEvent({
      eventType: "booking.confirmed",
      messageId: "msg_002",
      correlationId: "corr_002",
      payload: { email: "user@example.com", bookingId: "b2" },
    });

    const result = await consumer.processEvent({
      eventType: "booking.confirmed",
      messageId: "msg_002",
      correlationId: "corr_002",
      payload: { email: "user@example.com", bookingId: "b2" },
    });

    expect(result.outcome).toBe("duplicate");
    expect(ses.sent).toHaveLength(1); // not sent twice
  });

  it("returns no_template for unregistered event type", async () => {
    const result = await consumer.processEvent({
      eventType: "payment.refunded" as NotificationEventType,
      messageId: "msg_003",
      correlationId: "corr_003",
      payload: {},
    });
    expect(result.outcome).toBe("no_template");
  });

  it("different messageIds are processed independently", async () => {
    await consumer.processEvent({
      eventType: "booking.confirmed",
      messageId: "msg_004a",
      correlationId: "corr",
      payload: { email: "a@example.com", bookingId: "b3" },
    });
    await consumer.processEvent({
      eventType: "booking.confirmed",
      messageId: "msg_004b",
      correlationId: "corr",
      payload: { email: "b@example.com", bookingId: "b4" },
    });
    expect(ses.sent).toHaveLength(2);
  });
});
