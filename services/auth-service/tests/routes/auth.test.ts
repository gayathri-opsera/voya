import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { createAuthRouter } from "../../src/routes/auth.js";
import type { RegistrationService } from "../../src/services/registrationService.js";
import { PolicyViolationError } from "../../src/services/registrationService.js";

function makeService(overrides: Partial<RegistrationService> = {}): RegistrationService {
  return {
    register: vi.fn().mockResolvedValue({ outcome: "accepted" }),
    verifyEmail: vi.fn().mockResolvedValue({ verified: true }),
    ...overrides,
  } as unknown as RegistrationService;
}

function buildApp(svc: RegistrationService): Express {
  const app = express();
  app.use(express.json());
  app.use("/auth", createAuthRouter(svc));
  return app;
}

describe("POST /auth/register", () => {
  let svc: RegistrationService;
  let app: Express;

  beforeEach(() => {
    svc = makeService();
    app = buildApp(svc);
  });

  it("returns 202 with generic message for valid input", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "user@example.com", password: "SecurePass123!" });

    expect(res.status).toBe(202);
    expect(res.body.message).toBeTruthy();
  });

  it("returns 422 for invalid email", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "not-an-email", password: "SecurePass123!" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("returns 422 with rule details for password policy violation", async () => {
    (svc.register as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new PolicyViolationError([{ rule: "TOO_SHORT", message: "Too short" }]),
    );

    const res = await request(app)
      .post("/auth/register")
      .send({ email: "user@example.com", password: "x" });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].rule).toBe("TOO_SHORT");
  });

  it("returns 422 for unknown fields (.strict schema)", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "user@example.com", password: "SecurePass123!", unknownField: "x" });

    expect(res.status).toBe(422);
  });

  it("returns identical 202 response body for existing and new emails", async () => {
    const resNew = await request(app)
      .post("/auth/register")
      .send({ email: "new@example.com", password: "SecurePass123!" });

    const resDup = await request(app)
      .post("/auth/register")
      .send({ email: "new@example.com", password: "SecurePass123!" });

    expect(resNew.status).toBe(202);
    expect(resDup.status).toBe(202);
    expect(resNew.body).toEqual(resDup.body);
  });
});

describe("POST /auth/verify-email", () => {
  let svc: RegistrationService;
  let app: Express;

  beforeEach(() => {
    svc = makeService();
    app = buildApp(svc);
  });

  it("returns 200 with verified: true on success", async () => {
    const res = await request(app)
      .post("/auth/verify-email")
      .send({ token: "validtoken" });

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
  });

  it("returns 400 when token is invalid/expired", async () => {
    (svc.verifyEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      verified: false,
      reason: "expired",
    });

    const res = await request(app)
      .post("/auth/verify-email")
      .send({ token: "expiredtoken" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_or_expired_token");
  });

  it("returns 400 for missing token", async () => {
    const res = await request(app).post("/auth/verify-email").send({});
    expect(res.status).toBe(400);
  });
});

describe("POST /auth/resend-verification", () => {
  let svc: RegistrationService;
  let app: Express;

  beforeEach(() => {
    svc = makeService();
    app = buildApp(svc);
  });

  it("returns 202 for any email (enumeration safe)", async () => {
    const res = await request(app)
      .post("/auth/resend-verification")
      .send({ email: "any@example.com" });

    expect(res.status).toBe(202);
  });

  it("returns 202 even for unknown email", async () => {
    const res = await request(app)
      .post("/auth/resend-verification")
      .send({ email: "unknown@example.com" });

    expect(res.status).toBe(202);
  });
});
