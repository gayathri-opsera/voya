/**
 * TripDocumentEmailService — WO-055: Async trip document email delivery.
 *
 * Enqueues a trip document PDF generation + email job.
 * Returns immediately (202 Accepted) — actual delivery is async.
 */

export interface TripDocumentJob {
  bookingId: string;
  userId: string;
  email: string;
  requestedAt: Date;
}

export interface JobQueue {
  enqueue(queueName: string, payload: unknown): Promise<string>;
}

export class InMemoryJobQueue implements JobQueue {
  readonly jobs: Array<{ queueName: string; payload: unknown; id: string }> = [];
  async enqueue(queueName: string, payload: unknown): Promise<string> {
    const id = crypto.randomUUID();
    this.jobs.push({ queueName, payload, id });
    return id;
  }
}

export class TripDocumentEmailService {
  private readonly QUEUE_NAME = "trip-document-email";

  constructor(private readonly queue: JobQueue) {}

  async requestDelivery(bookingId: string, userId: string, email: string): Promise<{ jobId: string }> {
    const job: TripDocumentJob = { bookingId, userId, email, requestedAt: new Date() };
    const jobId = await this.queue.enqueue(this.QUEUE_NAME, job);
    return { jobId };
  }
}
