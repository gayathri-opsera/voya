import { describe, it, expect } from "vitest";
import { StripeWebhookVerifier, WebhookSignatureError } from "../../src/domain/StripeWebhookVerifier.ts";

describe("StripeWebhookVerifier", () => {
  const secret = "whsec_test_secret_key";

  it("accepts a valid webhook signature", () => {
    const body = JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" });
    const header = StripeWebhookVerifier.buildTestHeader(secret, body);
    const verifier = new StripeWebhookVerifier(secret);
    const result = verifier.verify(body, header);
    expect(result.valid).toBe(true);
    expect(result.eventType).toBe("payment_intent.succeeded");
  });

  it("rejects a tampered payload", () => {
    const body = JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" });
    const header = StripeWebhookVerifier.buildTestHeader(secret, body);
    const tamperedBody = body + " ";

    const verifier = new StripeWebhookVerifier(secret);
    expect(() => verifier.verify(tamperedBody, header)).toThrow(WebhookSignatureError);
  });

  it("rejects an expired timestamp", () => {
    const body = JSON.stringify({ id: "evt_2", type: "charge.refunded" });
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
    const header = StripeWebhookVerifier.buildTestHeader(secret, body, oldTimestamp);
    const verifier = new StripeWebhookVerifier(secret, 300);
    expect(() => verifier.verify(body, header)).toThrow(WebhookSignatureError);
  });

  it("rejects a wrong secret", () => {
    const body = JSON.stringify({ id: "evt_3", type: "customer.created" });
    const header = StripeWebhookVerifier.buildTestHeader("wrong_secret", body);
    const verifier = new StripeWebhookVerifier(secret);
    expect(() => verifier.verify(body, header)).toThrow(WebhookSignatureError);
  });

  it("throws when secret is empty", () => {
    expect(() => new StripeWebhookVerifier("")).toThrow("Webhook secret is required");
  });
});
