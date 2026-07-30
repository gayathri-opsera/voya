/**
 * SQS FIFO adapter stub — wired for production.
 *
 * Production usage requires @aws-sdk/client-sqs to be installed:
 *   pnpm --filter @travel/queue add @aws-sdk/client-sqs
 *
 * Key features of the full implementation:
 *   - SQS FIFO queues for ordered delivery per MessageGroupId
 *   - MessageDeduplicationId from payload hash for exactly-once
 *   - Long polling (WaitTimeSeconds=20) for cost efficiency
 *   - Visibility timeout management and explicit DeleteMessage on success
 *   - Dead-letter queue after configurable maxReceiveCount
 *   - Correlation ID forwarded via MessageAttribute
 */

import type { QueuePort, MessageHandler, PublishOptions, SubscribeOptions } from "./QueuePort.js";

export interface SQSConfig {
  region: string;
  accountId: string;
  queueUrlBase: string;
}

/**
 * Stub implementation.
 * Replace with real @aws-sdk/client-sqs implementation for production.
 */
export class SQSAdapter implements QueuePort {
  readonly name = "sqs";
  private readonly config: SQSConfig;

  constructor(config: SQSConfig) {
    this.config = config;
  }

  async publish<T>(
    queueName: string,
    type: string,
    payload: T,
    options?: PublishOptions & { correlationId?: string },
  ): Promise<string> {
    // TODO: Implement with SQSClient.send(new SendMessageCommand({
    //   QueueUrl: `${this.config.queueUrlBase}/${queueName}.fifo`,
    //   MessageBody: JSON.stringify({ type, payload }),
    //   MessageGroupId: options?.messageGroupId ?? type,
    //   MessageDeduplicationId: hash(JSON.stringify(payload)),
    //   MessageAttributes: { correlationId: { StringValue: options?.correlationId, DataType: 'String' } },
    // }))
    throw new Error("SQSAdapter.publish: not yet implemented — install @aws-sdk/client-sqs");
  }

  async subscribe<T>(
    _queueName: string,
    _handler: MessageHandler<T>,
    _options?: SubscribeOptions,
  ): Promise<() => Promise<void>> {
    throw new Error("SQSAdapter.subscribe: not yet implemented — install @aws-sdk/client-sqs");
  }

  async ping(): Promise<void> {
    throw new Error("SQSAdapter.ping: not yet implemented — install @aws-sdk/client-sqs");
  }

  async close(): Promise<void> {}
}
