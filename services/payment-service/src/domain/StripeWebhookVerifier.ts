/**
 * StripeWebhookVerifier — WO-046: Mandatory Stripe webhook signature verification.
 *
 * Validates incoming Stripe webhook events using the Stripe-Signature header.
 * Rejects events without a valid signature (HMAC SHA-256 using the webhook secret).
 *
 * This is a pure implementation (no Stripe SDK dependency) for testability.
 */

import { createHmac, timingSafeEqual } from "crypto";

export class WebhookSignatureError extends Error {
  constructor(reason: string) {
    super(`Webhook signature verification failed: ${reason}`);
    this.name = "WebhookSignatureError";
  }
}

export interface SignatureVerificationResult {
  valid: boolean;
  eventId: string;
  eventType: string;
  timestamp: number;
}

export class StripeWebhookVerifier {
  private readonly toleranceSeconds: number;

  constructor(
    private readonly webhookSecret: string,
    toleranceSeconds = 300, // 5 minutes default, matching Stripe SDK
  ) {
    if (!webhookSecret) throw new Error("Webhook secret is required");
    this.toleranceSeconds = toleranceSeconds;
  }

  /**
   * Verify a Stripe webhook payload against its signature header.
   * @param rawBody - The raw request body as a string or Buffer (MUST not be parsed)
   * @param signatureHeader - The value of the Stripe-Signature header
   */
  verify(rawBody: string | Buffer, signatureHeader: string): SignatureVerificationResult {
    const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");

    // Parse the Stripe-Signature header: "t=timestamp,v1=signature,v1=signature"
    const parts: Record<string, string[]> = {};
    for (const part of signatureHeader.split(",")) {
      const [key, ...rest] = part.split("=");
      const value = rest.join("=");
      if (!parts[key]) parts[key] = [];
      parts[key].push(value);
    }

    const timestamp = parseInt(parts["t"]?.[0] ?? "0", 10);
    const signatures = parts["v1"] ?? [];

    if (!timestamp || signatures.length === 0) {
      throw new WebhookSignatureError("Missing t or v1 components in Stripe-Signature header");
    }

    // Check timestamp tolerance
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > this.toleranceSeconds) {
      throw new WebhookSignatureError(`Timestamp too old: ${timestamp} vs ${now}`);
    }

    // Compute expected signature: HMAC-SHA256(t.payload)
    const signedPayload = `${timestamp}.${bodyStr}`;
    const expectedSig = createHmac("sha256", this.webhookSecret)
      .update(signedPayload, "utf-8")
      .digest("hex");

    // Constant-time comparison to prevent timing attacks
    const expectedBuf = Buffer.from(expectedSig);
    const matched = signatures.some((sig) => {
      const sigBuf = Buffer.from(sig);
      return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
    });

    if (!matched) {
      throw new WebhookSignatureError("Signature mismatch");
    }

    // Parse event for metadata (without trusting the payload further — validation done above)
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(bodyStr);
    } catch {
      throw new WebhookSignatureError("Could not parse event body as JSON");
    }

    return {
      valid: true,
      eventId: parsed["id"] as string,
      eventType: parsed["type"] as string,
      timestamp,
    };
  }

  /** Build a valid Stripe-Signature header for testing. */
  static buildTestHeader(secret: string, body: string, timestampOverride?: number): string {
    const t = timestampOverride ?? Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", secret).update(`${t}.${body}`, "utf-8").digest("hex");
    return `t=${t},v1=${sig}`;
  }
}
