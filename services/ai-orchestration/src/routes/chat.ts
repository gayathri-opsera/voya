import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "@travel/shared";

export const chatRouter = Router();

const ChatRequestSchema = z.object({
  message: z.string().trim().min(1, "Message is required"),
  sessionId: z.string().optional(),
});

const validateChat = validateRequest({ body: ChatRequestSchema });

chatRouter.post("/chat", validateChat, (_req, res) => {
  res.status(200).json({ reply: "" });
});
