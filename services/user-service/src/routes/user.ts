import { Router } from "express";
import { UpdateProfileRequestSchema } from "@travel/contracts/user";
import { validateRequest } from "@travel/shared";

export const userRouter = Router();

const validateUpdateProfile = validateRequest({ body: UpdateProfileRequestSchema });

userRouter.patch("/profile", validateUpdateProfile, (_req, res) => {
  res.status(200).json({ updated: true });
});

userRouter.get("/profile", (_req, res) => {
  res.status(200).json({ profile: null });
});
