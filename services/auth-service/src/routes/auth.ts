/**
 * Auth routes: register, verify-email, resend-verification.
 * All enumeration-sensitive endpoints return identical 202 bodies.
 */

import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { RegistrationService } from "../services/registrationService.js";
import { PolicyViolationError } from "../services/registrationService.js";
import type { LoginService } from "../services/loginService.js";
import type { RefreshService } from "../services/refreshService.js";
import type { SessionService } from "../services/sessionService.js";
import type { PasswordResetService } from "../services/passwordResetService.js";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(1024),
  displayName: z.string().max(200).optional(),
}).strict();

const VerifyEmailSchema = z.object({
  token: z.string().min(1).max(256),
}).strict();

const ResendSchema = z.object({
  email: z.string().email().max(320),
}).strict();

const LoginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(1024),
}).strict();

const RefreshBodySchema = z.object({
  refreshToken: z.string().min(1).max(512),
}).strict();

const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME ?? "refresh_token";
const COOKIE_SECURE = process.env.NODE_ENV === "production";

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: "strict" as const,
  path: "/auth/refresh",
};

const GENERIC_202 = { message: "If the address is valid you will receive a verification email." };

// ─── Rate-limit state (simple in-memory token bucket per key) ─────────────────

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const DEFAULT_LIMIT = parseInt(process.env.RATE_LIMIT_MAX ?? "5", 10);
const WINDOW_MS     = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10);

const buckets = new Map<string, Bucket>();

function isRateLimited(key: string): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: DEFAULT_LIMIT, lastRefill: now };
    buckets.set(key, bucket);
  }
  const elapsed = now - bucket.lastRefill;
  if (elapsed >= WINDOW_MS) {
    bucket.tokens = DEFAULT_LIMIT;
    bucket.lastRefill = now;
  }
  if (bucket.tokens <= 0) {
    const retryAfterSeconds = Math.ceil((WINDOW_MS - elapsed) / 1000);
    return { limited: true, retryAfterSeconds };
  }
  bucket.tokens -= 1;
  return { limited: false, retryAfterSeconds: 0 };
}

// ─── Router factory ───────────────────────────────────────────────────────────

export function createAuthRouter(
  registrationService: RegistrationService,
  loginService?: LoginService,
  refreshService?: RefreshService,
  sessionService?: SessionService,
  passwordResetService?: PasswordResetService,
  authMiddleware?: RequestHandler,
): Router {
  const router = Router();

  const register: RequestHandler = async (req, res, next) => {
    try {
      const ip = String(req.ip ?? req.socket.remoteAddress ?? "");
      const parsed = RegisterSchema.safeParse(req.body);
      if (!parsed.success) {
        const details = parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          rule: i.code,
          message: i.message,
        }));
        res.status(422).json({ error: { code: "validation_failed", details } });
        return;
      }

      const { email } = parsed.data;
      const key = `register:${email.toLowerCase()}:${ip}`;
      const { limited, retryAfterSeconds } = isRateLimited(key);
      if (limited) {
        res.status(429).json({ error: { code: "rate_limited", retryAfterSeconds } });
        return;
      }

      try {
        await registrationService.register(parsed.data);
      } catch (err) {
        if (err instanceof PolicyViolationError) {
          const details = err.violations.map((v) => ({ rule: v.rule, message: v.message }));
          res.status(422).json({ error: { code: "validation_failed", details } });
          return;
        }
        throw err;
      }

      res.status(202).json(GENERIC_202);
    } catch (err) {
      next(err);
    }
  };

  const verifyEmail: RequestHandler = async (req, res, next) => {
    try {
      const parsed = VerifyEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: "invalid_or_expired_token" } });
        return;
      }

      const result = await registrationService.verifyEmail(parsed.data.token);
      if (!result.verified) {
        res.status(400).json({ error: { code: "invalid_or_expired_token" } });
        return;
      }

      res.status(200).json({ verified: true });
    } catch (err) {
      next(err);
    }
  };

  const resendVerification: RequestHandler = async (req, res, next) => {
    try {
      const ip = String(req.ip ?? req.socket.remoteAddress ?? "");
      const parsed = ResendSchema.safeParse(req.body);
      if (parsed.success) {
        const key = `resend:${parsed.data.email.toLowerCase()}:${ip}`;
        const { limited, retryAfterSeconds } = isRateLimited(key);
        if (limited) {
          res.status(429).json({ error: { code: "rate_limited", retryAfterSeconds } });
          return;
        }
        // Fire-and-forget register (will resend if account exists/unverified)
        registrationService
          .register({ email: parsed.data.email, password: "" })
          .catch(() => undefined);
      }
      // Always 202 regardless
      res.status(202).json(GENERIC_202);
    } catch (err) {
      next(err);
    }
  };

  router.post("/register", register);
  router.post("/verify-email", verifyEmail);
  router.post("/resend-verification", resendVerification);

  if (loginService) {
    const login: RequestHandler = async (req, res, next) => {
      try {
        const ip = String(req.ip ?? req.socket.remoteAddress ?? "");
        const parsed = LoginSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: { code: "validation_failed", details: parsed.error.issues } });
          return;
        }

        const { email } = parsed.data;
        const key = `login:${email.toLowerCase()}:${ip}`;
        const { limited, retryAfterSeconds } = isRateLimited(key);
        if (limited) {
          res.status(429).json({ error: { code: "rate_limited", retryAfterSeconds } });
          return;
        }

        const result = await loginService.login({
          ...parsed.data,
          userAgent: req.headers["user-agent"],
          ipAddress: ip,
        });

        switch (result.outcome) {
          case "success":
            res.status(200).json({
              accessToken: result.accessToken,
              tokenType: result.tokenType,
              expiresIn: result.expiresIn,
              user: result.user,
            });
            break;
          case "invalid_credentials":
            res.status(401).json({ error: { code: "invalid_credentials" } });
            break;
          case "account_locked":
            res.status(423).json({ error: { code: "account_locked", retryAfterSeconds: result.retryAfterSeconds } });
            break;
          case "email_not_verified":
            res.status(403).json({ error: { code: "email_not_verified" } });
            break;
          case "account_disabled":
            res.status(403).json({ error: { code: "account_disabled" } });
            break;
        }
      } catch (err) {
        next(err);
      }
    };

    router.post("/login", login);
  }

  if (refreshService) {
    const refresh: RequestHandler = async (req, res, next) => {
      try {
        const ip = String(req.ip ?? req.socket.remoteAddress ?? "");

        // Accept refresh token from HttpOnly cookie OR request body
        const cookieToken = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME];
        let rawToken = cookieToken;

        if (!rawToken) {
          const parsed = RefreshBodySchema.safeParse(req.body);
          if (!parsed.success) {
            res.status(401).json({ error: { code: "invalid_refresh_token" } });
            return;
          }
          rawToken = parsed.data.refreshToken;
        }

        const result = await refreshService.refresh({
          refreshToken: rawToken,
          userAgent: req.headers["user-agent"],
          ipAddress: ip,
        });

        switch (result.outcome) {
          case "success":
            // Set rotated refresh cookie for browser clients
            res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
              httpOnly: true,
              secure: COOKIE_SECURE,
              sameSite: "strict",
              path: "/auth/refresh",
              maxAge: 14 * 24 * 3600 * 1000,
            });
            res.status(200).json({
              accessToken: result.accessToken,
              tokenType: result.tokenType,
              expiresIn: result.expiresIn,
              // Also return in body for non-browser clients
              refreshToken: result.refreshToken,
            });
            break;
          case "invalid_refresh_token":
            res.status(401).json({ error: { code: "invalid_refresh_token" } });
            break;
          case "refresh_token_reused":
            res.status(401).json({ error: { code: "refresh_token_reused" } });
            break;
          case "session_expired":
            res.status(401).json({ error: { code: "session_expired" } });
            break;
        }
      } catch (err) {
        next(err);
      }
    };

    router.post("/refresh", refresh);
  }

  // ─── Session management (requires auth) ─────────────────────────────────────

  if (sessionService && authMiddleware) {
    const logout: RequestHandler = async (req, res, next) => {
      try {
        const sessionId = req.principal?.sessionId;
        if (sessionId) await sessionService.revokeById(sessionId);
        res.clearCookie(REFRESH_COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    };

    const logoutAll: RequestHandler = async (req, res, next) => {
      try {
        const userId = req.principal!.userId;
        const count = await sessionService.revokeAllForUser(userId);
        res.clearCookie(REFRESH_COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
        res.status(200).json({ revokedCount: count });
      } catch (err) {
        next(err);
      }
    };

    const listSessions: RequestHandler = async (req, res, next) => {
      try {
        const { userId, sessionId } = req.principal!;
        const sessions = await sessionService.listActiveForUser(userId, sessionId);
        res.status(200).json({ sessions });
      } catch (err) {
        next(err);
      }
    };

    const revokeSession: RequestHandler = async (req, res, next) => {
      try {
        const { id } = req.params;
        if (!id) { res.status(400).json({ error: { code: "bad_request" } }); return; }
        const result = await sessionService.revokeForUser(id, req.principal!.userId);
        if (result === "not_found") {
          res.status(404).json({ error: { code: "session_not_found" } });
          return;
        }
        if (req.principal?.sessionId === id) {
          res.clearCookie(REFRESH_COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
        }
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    };

    router.post("/logout", authMiddleware, logout);
    router.post("/logout-all", authMiddleware, logoutAll);
    router.get("/sessions", authMiddleware, listSessions);
    router.delete("/sessions/:id", authMiddleware, revokeSession);
  }

  // ─── Password reset ──────────────────────────────────────────────────────────

  if (passwordResetService) {
    const ForgotPasswordSchema = z.object({ email: z.string().email().max(320) }).strict();
    const ResetPasswordSchema = z.object({
      token: z.string().min(1).max(512),
      password: z.string().min(1).max(1024),
    }).strict();

    const RESET_GENERIC_202 = { message: "If the address is valid you will receive reset instructions." };

    const forgotPassword: RequestHandler = async (req, res, next) => {
      try {
        const ip = String(req.ip ?? req.socket.remoteAddress ?? "");
        const parsed = ForgotPasswordSchema.safeParse(req.body);
        if (parsed.success) {
          const key = `forgot:${parsed.data.email.toLowerCase()}:${ip}`;
          const { limited, retryAfterSeconds } = isRateLimited(key);
          if (limited) {
            res.status(429).json({ error: { code: "rate_limited", retryAfterSeconds } });
            return;
          }
          await passwordResetService.requestReset({ email: parsed.data.email });
        }
        res.status(202).json(RESET_GENERIC_202);
      } catch (err) {
        next(err);
      }
    };

    const resetPassword: RequestHandler = async (req, res, next) => {
      try {
        const ip = String(req.ip ?? req.socket.remoteAddress ?? "");
        const parsed = ResetPasswordSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: { code: "invalid_or_expired_token" } });
          return;
        }

        const key = `reset:${ip}`;
        const { limited, retryAfterSeconds } = isRateLimited(key);
        if (limited) {
          res.status(429).json({ error: { code: "rate_limited", retryAfterSeconds } });
          return;
        }

        const result = await passwordResetService.resetPassword(parsed.data);
        if (!result.ok) {
          if (result.reason === "invalid_or_expired_token") {
            res.status(400).json({ error: { code: "invalid_or_expired_token" } });
          } else if (result.reason === "password_reuse") {
            res.status(422).json({ error: { code: "password_reuse_not_allowed" } });
          } else {
            res.status(422).json({ error: { code: "validation_failed" } });
          }
          return;
        }
        res.status(200).json({ reset: true });
      } catch (err) {
        next(err);
      }
    };

    router.post("/forgot-password", forgotPassword);
    router.post("/reset-password", resetPassword);
  }

  return router;
}
