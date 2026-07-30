/**
 * RabbitMQ adapter stub — wired for local development.
 *
 * Production usage requires amqplib to be installed:
 *   pnpm --filter @travel/queue add amqplib
 *
 * The full implementation wraps the amqplib channel API with:
 *   - Connection pooling with automatic reconnection
 *   - Prefetch(1) per consumer for fair dispatch
 *   - Manual ack after successful handler invocation
 *   - Dead-letter exchange routing on handler failure
 *   - Correlation ID header propagation
 */

import type { QueuePort, MessageHandler, PublishOptions, SubscribeOptions } from "./QueuePort.js";

export interface RabbitMQConfig {
  url: string;
  prefetch?: number;
}

/**
 * Stub implementation.
 * Replace with real amqplib implementation when running locally or in staging.
 */
export class RabbitMQAdapter implements QueuePort {
  readonly name = "rabbitmq";
  private readonly config: RabbitMQConfig;

  constructor(config: RabbitMQConfig) {
    this.config = config;
  }

  async publish<T>(
    queueName: string,
    type: string,
    payload: T,
    options?: PublishOptions & { correlationId?: string },
  ): Promise<string> {
    // TODO: Implement with amqplib channel.sendToQueue
    // const messageId = uuidv4();
    // channel.sendToQueue(queueName, Buffer.from(JSON.stringify({ messageId, type, payload })), {
    //   correlationId: options?.correlationId,
    //   messageId,
    //   contentType: 'application/json',
    // });
    throw new Error("RabbitMQAdapter.publish: not yet implemented — install amqplib");
  }

  async subscribe<T>(
    _queueName: string,
    _handler: MessageHandler<T>,
    _options?: SubscribeOptions,
  ): Promise<() => Promise<void>> {
    throw new Error("RabbitMQAdapter.subscribe: not yet implemented — install amqplib");
  }

  async ping(): Promise<void> {
    throw new Error("RabbitMQAdapter.ping: not yet implemented — install amqplib");
  }

  async close(): Promise<void> {}
}
