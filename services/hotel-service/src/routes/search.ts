import { Router } from "express";
import { HotelSearchRequestSchema } from "@travel/contracts/search";
import { validateRequest } from "@travel/shared";

export const searchRouter = Router();

const validateHotelSearch = validateRequest({ body: HotelSearchRequestSchema });

searchRouter.post("/search", validateHotelSearch, (_req, res) => {
  res.status(200).json({ offers: [] });
});

searchRouter.get("/:offerId", (_req, res) => {
  res.status(200).json({ offer: null });
});
