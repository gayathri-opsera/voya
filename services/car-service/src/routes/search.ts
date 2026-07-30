import { Router } from "express";
import { CarRentalSearchRequestSchema } from "@travel/contracts/search";
import { validateRequest } from "@travel/shared";

export const searchRouter = Router();

const validateCarSearch = validateRequest({ body: CarRentalSearchRequestSchema });

searchRouter.post("/search", validateCarSearch, (_req, res) => {
  res.status(200).json({ offers: [] });
});

searchRouter.get("/:offerId", (_req, res) => {
  res.status(200).json({ offer: null });
});
