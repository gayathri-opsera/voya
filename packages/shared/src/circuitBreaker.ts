/**
 * CircuitBreaker — WO-029: Circuit breaker pattern for supplier resilience.
 *
 * States:
 * - CLOSED: requests pass through normally
 * - OPEN: requests fail immediately (no supplier call)
 * - HALF_OPEN: one request allowed through to test recovery
 *
 * Transitions:
 * - CLOSED → OPEN: after failureThreshold consecutive failures
 * - OPEN → HALF_OPEN: after resetTimeoutMs
 * - HALF_OPEN → CLOSED: on successful request
 * - HALF_OPEN → OPEN: on failed request
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  failureThreshold: number; // Failures before opening
  resetTimeoutMs: number;   // Time before transitioning to HALF_OPEN
  successThreshold: number; // Successes needed to close from HALF_OPEN
}

export class CircuitBreakerOpenError extends Error {
  constructor(public readonly supplierName: string) {
    super(`Circuit breaker is OPEN for supplier: ${supplierName}`);
    this.name = "CircuitBreakerOpenError";
  }
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureAt: number | null = null;

  constructor(
    public readonly name: string,
    private readonly config: CircuitBreakerConfig = {
      failureThreshold: 5,
      resetTimeoutMs: 60_000,
      successThreshold: 2,
    },
  ) {}

  get currentState(): CircuitState { return this.state; }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      const now = Date.now();
      if (this.lastFailureAt !== null && now - this.lastFailureAt >= this.config.resetTimeoutMs) {
        this.state = "HALF_OPEN";
        this.successCount = 0;
      } else {
        throw new CircuitBreakerOpenError(this.name);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = "CLOSED";
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureAt = Date.now();
    if (this.state === "HALF_OPEN" || this.failureCount >= this.config.failureThreshold) {
      this.state = "OPEN";
    }
  }

  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureAt = null;
  }
}
