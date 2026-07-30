import { Router, raw } from "express";

export const webhookRouter = Router();

// Stripe webhook MUST receive raw body for HMAC signature verification
// validateRequest middleware is deliberately NOT applied to this route
webhookRouter.post("/webhook", raw({ type: "application/json" }), (_req, res) => {
  // Signature verification handled in the service layer
  res.status(200).json({ received: true });
});
