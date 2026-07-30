/**
 * NotificationConsumer — WO-052: Exactly-once SES delivery via queue.
 *
 * Consumes events from the queue (booking.confirmed, payment.succeeded, etc.)
 * and sends transactional emails via SES. Uses the processed_events table
 * for exactly-once delivery to prevent duplicate emails.
 */

export type NotificationEventType =
  | "booking.confirmed"
  | "booking.cancelled"
  | "payment.succeeded"
  | "payment.refunded"
  | "auth.verification_required"
  | "auth.password_reset";

export interface EmailPayload {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

export interface NotificationTemplate {
  render(data: unknown): EmailPayload;
}

export interface SesPort {
  send(email: EmailPayload & { idempotencyKey: string }): Promise<{ messageId: string }>;
}

export interface NotificationIdempotencyStore {
  markProcessed(key: string): Promise<{ alreadyProcessed: boolean }>;
}

export class NotificationConsumer {
  constructor(
    private readonly sesPort: SesPort,
    private readonly idempotencyStore: NotificationIdempotencyStore,
    private readonly templates: Partial<Record<NotificationEventType, NotificationTemplate>>,
  ) {}

  async processEvent(event: {
    eventType: NotificationEventType;
    messageId: string;
    correlationId: string;
    payload: unknown;
  }): Promise<
    | { outcome: "sent"; sesMessageId: string }
    | { outcome: "duplicate" }
    | { outcome: "no_template" }
  > {
    const idempotencyKey = `notification:${event.messageId}`;

    // Exactly-once check
    const { alreadyProcessed } = await this.idempotencyStore.markProcessed(idempotencyKey);
    if (alreadyProcessed) return { outcome: "duplicate" };

    const template = this.templates[event.eventType];
    if (!template) return { outcome: "no_template" };

    const email = template.render(event.payload);
    const result = await this.sesPort.send({ ...email, idempotencyKey });

    return { outcome: "sent", sesMessageId: result.messageId };
  }
}
