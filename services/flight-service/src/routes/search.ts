import { Router } from "express";
import { FlightSearchRequestSchema } from "@travel/contracts/search";
import { validateRequest } from "@travel/shared";

export const searchRouter = Router();

// Schema resolved ONCE at module scope
const validateFlightSearch = validateRequest({ body: FlightSearchRequestSchema });

searchRouter.post("/search", validateFlightSearch, (_req, res) => {
  res.status(200).json({ offers: [] });
});

searchRouter.get("/:offerId", (_req, res) => {
  res.status(200).json({ offer: null });
});
