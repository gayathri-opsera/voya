/**
 * QueuePort — the abstract message bus interface.
 *
 * Backed by:
 *   RabbitMQ adapter  — local development and staging
 *   SQS adapter       — production (AWS SQS FIFO queues)
 *   InMemory adapter  — unit testing
 *
 * Every message carries:
 *   - type: string identifying the domain event
 *   - payload: typed domain event body
 *   - correlationId: propagated from inbound request for tracing
 *   - messageId: unique identifier for deduplication (SQS MessageDeduplicationId)
 */

export interface QueueMessage<T = unknown> {
  messageId: string;
  type: string;
  payload: T;
  correlationId?: string;
  timestamp: Date;
  attributes?: Record<string, string>;
}

export type MessageHandler<T = unknown> = (
  message: QueueMessage<T>,
) => Promise<void>;

export interface PublishOptions {
  /** For SQS FIFO: groups messages that must be processed in order. */
  messageGroupId?: string;
  /** Delay delivery by this many seconds (0–900). */
  delaySeconds?: number;
}

export interface SubscribeOptions {
  /** How many messages to poll in one batch (1–10). */
  maxMessages?: number;
  /** How long to wait for messages (long polling, seconds). */
  waitTimeSeconds?: number;
}

/**
 * QueuePort — implement this for each transport.
 */
export interface QueuePort {
  readonly name: string;

  /** Publish a message to the queue. Returns the message ID. */
  publish<T>(
    queueName: string,
    type: string,
    payload: T,
    options?: PublishOptions & { correlationId?: string },
  ): Promise<string>;

  /** Subscribe to messages on the queue. Returns an unsubscribe function. */
  subscribe<T>(
    queueName: string,
    handler: MessageHandler<T>,
    options?: SubscribeOptions,
  ): Promise<() => Promise<void>>;

  /** Check queue connectivity. */
  ping(): Promise<void>;

  /** Graceful shutdown. */
  close(): Promise<void>;
}
