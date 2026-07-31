import { randomBytes } from 'node:crypto';

/** Generate a random 32-hex-char correlation ID for request tracing. */
export function generateCorrelationId(): string {
  return randomBytes(16).toString('hex');
}
