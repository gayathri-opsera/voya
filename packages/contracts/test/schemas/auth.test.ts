import { describe, it, expect } from "vitest";
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  PasswordResetConfirmSchema,
  ActorContextSchema,
  OAuthCallbackSchema,
} from "../../src/auth/index.js";
import {
  rawRegisterPayload,
  rawLoginPayload,
  rawActorContext,
  invalidAuthPayloads,
} from "../fixtures/auth.js";

describe("RegisterRequestSchema", () => {
  it("parses a valid registration payload", () => {
    const result = RegisterRequestSchema.safeParse(rawRegisterPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("jane.doe@example.com");
      expect(result.data.firstName).toBe("Jane");
    }
  });

  it("normalises email to lowercase", () => {
    const result = RegisterRequestSchema.safeParse({
      ...rawRegisterPayload,
      email: "Jane.DOE@EXAMPLE.COM",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("jane.doe@example.com");
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = RegisterRequestSchema.safeParse(invalidAuthPayloads.shortPassword);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("password"));
      expect(issue?.message).toMatch(/at least 8 characters/i);
    }
  });

  it("rejects a password with no uppercase letter", () => {
    const result = RegisterRequestSchema.safeParse(invalidAuthPayloads.noUppercase);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("password"));
      expect(issue?.message).toMatch(/uppercase/i);
    }
  });

  it("rejects a password with no digit", () => {
    const result = RegisterRequestSchema.safeParse(invalidAuthPayloads.noDigit);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("password"));
      expect(issue?.message).toMatch(/number/i);
    }
  });

  it("rejects an invalid email", () => {
    const result = RegisterRequestSchema.safeParse(invalidAuthPayloads.invalidEmail);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("email"));
      expect(issue?.message).toMatch(/valid email/i);
    }
  });

  it("rejects an empty first name", () => {
    const result = RegisterRequestSchema.safeParse(invalidAuthPayloads.missingFirstName);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("firstName"));
      expect(issue).toBeDefined();
    }
  });
});

describe("LoginRequestSchema", () => {
  it("parses valid login credentials", () => {
    const result = LoginRequestSchema.safeParse(rawLoginPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("jane.doe@example.com");
    }
  });

  it("normalises email to lowercase on login", () => {
    const result = LoginRequestSchema.safeParse({ ...rawLoginPayload, email: "JANE.DOE@EXAMPLE.COM" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("jane.doe@example.com");
    }
  });
});

describe("PasswordResetConfirmSchema", () => {
  it("parses valid password reset confirmation", () => {
    const result = PasswordResetConfirmSchema.safeParse({
      token: "reset_token_abc",
      newPassword: "NewSecure1!",
      confirmPassword: "NewSecure1!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when passwords do not match", () => {
    const result = PasswordResetConfirmSchema.safeParse({
      token: "reset_token_abc",
      newPassword: "NewSecure1!",
      confirmPassword: "Different1!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("confirmPassword"));
      expect(issue?.message).toMatch(/do not match/i);
    }
  });
});

describe("ActorContextSchema", () => {
  it("parses a valid JWT payload", () => {
    const result = ActorContextSchema.safeParse(rawActorContext);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("traveler");
    }
  });

  it("rejects an invalid role", () => {
    const result = ActorContextSchema.safeParse({ ...rawActorContext, role: "admin" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("role"));
      expect(issue?.message).toMatch(/traveler|support_agent|system/i);
    }
  });
});

describe("OAuthCallbackSchema", () => {
  it("parses a valid Google OAuth callback", () => {
    const result = OAuthCallbackSchema.safeParse({
      code: "oauth_code_abc",
      state: "csrf_state_xyz",
      provider: "google",
      redirectUri: "https://voya.app/auth/callback/google",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provider).toBe("google");
    }
  });

  it("rejects an unsupported OAuth provider", () => {
    const result = OAuthCallbackSchema.safeParse({
      code: "oauth_code_abc",
      state: "csrf_state_xyz",
      provider: "facebook",
      redirectUri: "https://voya.app/auth/callback/facebook",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("provider"));
      expect(issue?.message).toMatch(/google|apple/i);
    }
  });
});
