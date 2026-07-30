import { Router } from "express";
import { RegisterRequestSchema, LoginRequestSchema } from "@travel/contracts/auth";
import { validateRequest } from "@travel/shared";

export const authRouter = Router();

const validateRegister = validateRequest({ body: RegisterRequestSchema });
const validateLogin = validateRequest({ body: LoginRequestSchema });

authRouter.post("/register", validateRegister, (_req, res) => {
  res.status(201).json({ userId: "user_stub" });
});

authRouter.post("/login", validateLogin, (_req, res) => {
  res.status(200).json({ accessToken: "token_stub" });
});
