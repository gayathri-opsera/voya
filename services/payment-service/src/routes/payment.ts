import { Router } from "express";
import { PaymentIntentRequestSchema } from "@travel/contracts/payment";
import { validateRequest } from "@travel/shared";

export const paymentRouter = Router();

const validatePaymentIntent = validateRequest({ body: PaymentIntentRequestSchema });

paymentRouter.post("/intent", validatePaymentIntent, (_req, res) => {
  res.status(200).json({ paymentIntentId: "pi_stub" });
});

paymentRouter.get("/:paymentId", (_req, res) => {
  res.status(200).json({ payment: null });
});
