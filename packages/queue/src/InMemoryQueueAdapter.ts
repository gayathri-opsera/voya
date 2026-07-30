/**
 * InMemoryQueueAdapter — for unit testing.
 *
 * Messages are held in an in-memory queue per topic.
 * Subscribers are called synchronously on publish to simplify test assertions.
 */

import type {
  QueuePort,
  QueueMessage,
  MessageHandler,
  PublishOptions,
  SubscribeOptions,
} from "./QueuePort.js";

export class InMemoryQueueAdapter implements QueuePort {
  readonly name = "in-memory";

  private readonly queues = new Map<
    string,
    { messages: QueueMessage[]; handlers: MessageHandler[] }
  >();

  private getQueue(name: string) {
    if (!this.queues.has(name)) {
      this.queues.set(name, { messages: [], handlers: [] });
    }
    return this.queues.get(name)!;
  }

  async publish<T>(
    queueName: string,
    type: string,
    payload: T,
    options?: PublishOptions & { correlationId?: string },
  ): Promise<string> {
    const messageId = Math.random().toString(36).slice(2);
    const message: QueueMessage<T> = {
      messageId,
      type,
      payload,
      correlationId: options?.correlationId,
      timestamp: new Date(),
    };
    const queue = this.getQueue(queueName);
    queue.messages.push(message as QueueMessage);

    // Deliver to all subscribers synchronously (simplifies test assertions)
    for (const handler of queue.handlers) {
      await handler(message as QueueMessage);
    }
    return messageId;
  }

  async subscribe<T>(
    queueName: string,
    handler: MessageHandler<T>,
    _options?: SubscribeOptions,
  ): Promise<() => Promise<void>> {
    const queue = this.getQueue(queueName);
    queue.handlers.push(handler as MessageHandler);

    // Return unsubscribe function
    return async () => {
      const idx = queue.handlers.indexOf(handler as MessageHandler);
      if (idx !== -1) queue.handlers.splice(idx, 1);
    };
  }

  async ping(): Promise<void> {}
  async close(): Promise<void> {}

  /** For test assertions: get all messages published to a queue. */
  getMessages(queueName: string): QueueMessage[] {
    return this.queues.get(queueName)?.messages ?? [];
  }

  /** Clear all messages and subscribers. */
  clear(): void {
    this.queues.clear();
  }
}
