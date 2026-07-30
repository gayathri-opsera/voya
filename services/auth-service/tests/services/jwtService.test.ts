import { describe, it, expect } from "vitest";
import { TokenService, createHmacKey } from "../../src/services/jwtService.js";

function makeService(overrides?: Partial<ConstructorParameters<typeof TokenService>[0]>) {
  const key = createHmacKey("test-secret-that-is-long-enough-for-hs256");
  return new TokenService({
    signingKey: key,
    issuer: "test-issuer",
    audience: "test-audience",
    expiresInSeconds: 900,
    clockSkewSeconds: 5,
    ...overrides,
  });
}

describe("TokenService.mint", () => {
  it("produces a token that decodes to expected claims", () => {
    const svc = makeService();
    const { token, expiresIn } = svc.mint({ userId: "u1", sessionId: "s1", roles: ["user"] });

    expect(typeof token).toBe("string");
    expect(expiresIn).toBe(900);

    const result = svc.verify(token);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("should be ok");

    expect(result.claims.sub).toBe("u1");
    expect(result.claims.sid).toBe("s1");
    expect(result.claims.roles).toEqual(["user"]);
    expect(result.claims.iss).toBe("test-issuer");
    expect(result.claims.aud).toBe("test-audience");
    expect(result.claims.jti).toBeTruthy();
  });

  it("includes exp and iat claims", () => {
    const svc = makeService();
    const { token } = svc.mint({ userId: "u1", sessionId: "s1", roles: [] });
    const result = svc.verify(token);
    if (!result.ok) throw new Error("should be ok");

    expect(result.claims.iat).toBeTypeOf("number");
    expect(result.claims.exp).toBeGreaterThan(result.claims.iat);
  });
});

describe("TokenService.verify — rejection cases", () => {
  it("rejects an expired token", async () => {
    const key = createHmacKey("test-secret-that-is-long-enough-for-hs256");
    const svc = new TokenService({
      signingKey: key,
      issuer: "test-issuer",
      audience: "test-audience",
      expiresInSeconds: -1, // already expired
      clockSkewSeconds: 0,
    });

    const { token } = svc.mint({ userId: "u1", sessionId: "s1", roles: [] });
    const result = svc.verify(token);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("should fail");
    expect(result.reason).toBe("expired");
  });

  it("rejects a tampered payload", () => {
    const svc = makeService();
    const { token } = svc.mint({ userId: "u1", sessionId: "s1", roles: [] });

    // Tamper with payload
    const [header, , sig] = token.split(".");
    const fakePayload = Buffer.from(JSON.stringify({ sub: "HACKER", sid: "s1", roles: ["admin"] })).toString("base64url");
    const tampered = `${header}.${fakePayload}.${sig}`;

    const result = svc.verify(tampered);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("should fail");
    expect(result.reason).toBe("invalid_signature");
  });

  it("rejects the none algorithm", () => {
    const svc = makeService();
    const { token } = svc.mint({ userId: "u1", sessionId: "s1", roles: [] });
    const [, payload] = token.split(".");

    // Craft a none-algorithm token
    const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const noneToken = `${noneHeader}.${payload}.`;

    const result = svc.verify(noneToken);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("should fail");
    expect(result.reason).toBe("invalid_algorithm");
  });

  it("rejects wrong issuer", () => {
    const key = createHmacKey("test-secret-that-is-long-enough-for-hs256");
    const svcA = new TokenService({ signingKey: key, issuer: "issuer-a", audience: "aud", expiresInSeconds: 900 });
    const svcB = new TokenService({ signingKey: key, issuer: "issuer-b", audience: "aud", expiresInSeconds: 900 });

    const { token } = svcA.mint({ userId: "u1", sessionId: "s1", roles: [] });
    const result = svcB.verify(token);

    expect(result.ok).toBe(false);
  });

  it("rejects wrong audience", () => {
    const key = createHmacKey("test-secret-that-is-long-enough-for-hs256");
    const svcA = new TokenService({ signingKey: key, issuer: "iss", audience: "aud-a", expiresInSeconds: 900 });
    const svcB = new TokenService({ signingKey: key, issuer: "iss", audience: "aud-b", expiresInSeconds: 900 });

    const { token } = svcA.mint({ userId: "u1", sessionId: "s1", roles: [] });
    const result = svcB.verify(token);

    expect(result.ok).toBe(false);
  });

  it("rejects an unknown kid", () => {
    const keyA = createHmacKey("secret-for-key-a-that-is-long-enough");
    const keyB = createHmacKey("secret-for-key-b-that-is-long-enough");

    const svcA = new TokenService({ signingKey: keyA, issuer: "iss", audience: "aud", expiresInSeconds: 900 });
    const svcB = new TokenService({ signingKey: keyB, issuer: "iss", audience: "aud", expiresInSeconds: 900 });

    const { token } = svcA.mint({ userId: "u1", sessionId: "s1", roles: [] });
    const result = svcB.verify(token);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("should fail");
    expect(result.reason).toBe("unknown_kid");
  });

  it("accepts tokens from a rotation-overlap key", () => {
    const oldKey = createHmacKey("old-secret-that-is-long-enough-for-hs256");
    const newKey = createHmacKey("new-secret-that-is-long-enough-for-hs256");

    const svcOld = new TokenService({ signingKey: oldKey, issuer: "iss", audience: "aud", expiresInSeconds: 900 });
    const { token } = svcOld.mint({ userId: "u1", sessionId: "s1", roles: [] });

    // New service: newKey is primary, oldKey is in verification overlap
    const svcNew = new TokenService({
      signingKey: newKey,
      verificationKeys: [oldKey],
      issuer: "iss",
      audience: "aud",
      expiresInSeconds: 900,
    });

    const result = svcNew.verify(token);
    expect(result.ok).toBe(true);
  });
});
