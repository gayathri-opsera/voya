import { describe, it, expect } from "vitest";
import {
  PaymentIntentRequestSchema,
  RefundRequestSchema,
} from "../../src/payment/index.js";
import {
  rawPaymentIntentPayload,
  rawRefundPayload,
  invalidPaymentPayloads,
} from "../fixtures/payment.js";

describe("PaymentIntentRequestSchema", () => {
  it("parses a valid payment intent request", () => {
    const result = PaymentIntentRequestSchema.safeParse(rawPaymentIntentPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe("450.00");
      expect(result.data.currency).toBe("USD");
      expect(result.data.paymentMethodType).toBe("CARD");
    }
  });

  it("defaults paymentMethodType to CARD when omitted", () => {
    const { paymentMethodType: _skip, ...withoutMethod } = rawPaymentIntentPayload;
    const result = PaymentIntentRequestSchema.safeParse(withoutMethod);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paymentMethodType).toBe("CARD");
    }
  });

  it("rejects negative amount", () => {
    const result = PaymentIntentRequestSchema.safeParse(invalidPaymentPayloads.negativeAmount);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("amount"));
      expect(issue).toBeDefined();
    }
  });

  it("rejects zero amount", () => {
    const result = PaymentIntentRequestSchema.safeParse(invalidPaymentPayloads.zeroAmount);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid currency code (4 chars)", () => {
    const result = PaymentIntentRequestSchema.safeParse(invalidPaymentPayloads.invalidCurrency);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("currency"));
      expect(issue).toBeDefined();
    }
  });

  it("rejects an invalid return URL", () => {
    const result = PaymentIntentRequestSchema.safeParse(invalidPaymentPayloads.invalidReturnUrl);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("returnUrl"));
      expect(issue).toBeDefined();
    }
  });
});

describe("RefundRequestSchema", () => {
  it("parses a valid refund request", () => {
    const result = RefundRequestSchema.safeParse(rawRefundPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe("450.00");
      expect(result.data.reason).toMatch(/cancellation/i);
    }
  });

  it("rejects an empty refund reason", () => {
    const result = RefundRequestSchema.safeParse({ ...rawRefundPayload, reason: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("reason"));
      expect(issue?.message).toMatch(/required/i);
    }
  });
});
