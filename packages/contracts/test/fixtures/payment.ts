export const rawPaymentIntentPayload = {
  bookingId: "book_01J9X0Y2Z3A4B5C6D7E8F9G0H3",
  amount: "450.00",
  currency: "USD",
  paymentMethodType: "CARD",
  idempotencyKey: "idem_pay_01J9X0Y2Z3A4B5C6D7E8F9G1",
  returnUrl: "https://voya.app/booking/confirmation",
};

export const rawPaymentIntentResponse = {
  paymentIntentId: "pi_01J9X0Y2Z3A4B5C6D7E8F9G2",
  bookingId: "book_01J9X0Y2Z3A4B5C6D7E8F9G0H3",
  status: "PENDING",
  amount: "450.00",
  currency: "USD",
  clientSecret: "pi_secret_abc123",
  createdAt: "2099-06-14T20:00:00.000Z",
  expiresAt: "2099-06-14T21:00:00.000Z",
};

export const rawRefundPayload = {
  bookingId: "book_01J9X0Y2Z3A4B5C6D7E8F9G0H3",
  paymentId: "pi_01J9X0Y2Z3A4B5C6D7E8F9G2",
  amount: "450.00",
  currency: "USD",
  reason: "Customer requested cancellation within free cancellation window",
  idempotencyKey: "idem_ref_01J9X0Y2Z3A4B5C6D7E8F9G3",
};

export const invalidPaymentPayloads = {
  negativeAmount: { ...rawPaymentIntentPayload, amount: "-100.00" },
  zeroAmount: { ...rawPaymentIntentPayload, amount: "0.00" },
  invalidCurrency: { ...rawPaymentIntentPayload, currency: "USDD" },
  invalidReturnUrl: { ...rawPaymentIntentPayload, returnUrl: "not-a-url" },
};
