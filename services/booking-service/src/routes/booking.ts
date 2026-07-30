import { Router } from "express";
import { CreateBookingRequestSchema } from "@travel/contracts/booking";
import { validateRequest } from "@travel/shared";

export const bookingRouter = Router();

const validateCreateBooking = validateRequest({ body: CreateBookingRequestSchema });

bookingRouter.post("/", validateCreateBooking, (_req, res) => {
  res.status(201).json({ bookingId: "book_stub" });
});

bookingRouter.get("/:bookingId", (_req, res) => {
  res.status(200).json({ booking: null });
});
