import { Writable } from "stream";
import { createLogger, createChildLogger } from "../src/logger.js";
import {
  syntheticTraveler,
  syntheticHeaderSet,
  syntheticPiiError,
  syntheticPassengers,
} from "./fixtures/pii-fixtures.js";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function captureLogger(service = "test-service", level = "info"): {
  logger: ReturnType<typeof createLogger>;
  lines: () => string[];
} {
  const output: string[] = [];
  const dest = new Writable({
    write(chunk: Buffer, _enc, cb) {
      output.push(chunk.toString());
      cb();
    },
  });

  const prevEnv = process.env["NODE_ENV"];
  process.env["NODE_ENV"] = "test";
  const prevLevel = process.env["LOG_LEVEL"];
  process.env["LOG_LEVEL"] = level;

  const logger = createLogger({ service, _destination: dest });

  process.env["NODE_ENV"] = prevEnv;
  if (prevLevel === undefined) delete process.env["LOG_LEVEL"];
  else process.env["LOG_LEVEL"] = prevLevel;

  return { logger, lines: () => output };
}

function parseLastLine(lines: string[]): Record<string, unknown> {
  const last = lines.filter((l) => l.trim().length > 0).at(-1);
  if (!last) throw new Error("No output captured");
  return JSON.parse(last.trim()) as Record<string, unknown>;
}

// ─── JSON shape tests ──────────────────────────────────────────────────────────

describe("createLogger", () => {
  it("throws when service name is missing", () => {
    expect(() => createLogger({ service: "" })).toThrow("service name is required");
  });

  it("emits parseable JSON with required fields", () => {
    const { logger, lines } = captureLogger("flight-service");
    logger.info("startup");
    const record = parseLastLine(lines());
    expect(record["level"]).toBeDefined();
    expect(record["time"]).toBeDefined();
    expect(record["service"]).toBe("flight-service");
    expect(record["msg"]).toBe("startup");
  });

  it("respects the level field — debug excluded at info level", () => {
    const { logger, lines } = captureLogger("test-service", "info");
    logger.debug("debug-should-not-appear");
    expect(lines().filter((l) => l.includes("debug-should-not-appear"))).toHaveLength(0);
  });

  it("includes base env binding", () => {
    const { logger, lines } = captureLogger();
    logger.info("test");
    const record = parseLastLine(lines());
    expect(record["env"]).toBeDefined();
  });
});

// ─── Child logger tests ────────────────────────────────────────────────────────

describe("createChildLogger", () => {
  it("merges typed context fields into child bindings", () => {
    const { logger, lines } = captureLogger();
    const child = createChildLogger(logger, {
      correlationId: "corr-abc",
      userId: "user-123",
      operation: "search.flight",
    });
    child.info("child msg");
    const record = parseLastLine(lines());
    expect(record["correlationId"]).toBe("corr-abc");
    expect(record["userId"]).toBe("user-123");
    expect(record["operation"]).toBe("search.flight");
  });

  it("works with no-context (notification consumer path)", () => {
    const { logger, lines } = captureLogger();
    const child = createChildLogger(logger, {});
    child.info("no context");
    const record = parseLastLine(lines());
    expect(record["msg"]).toBe("no context");
  });
});

// ─── PII redaction tests ───────────────────────────────────────────────────────

describe("PII redaction — top-level", () => {
  it("redacts email at top level", () => {
    const { logger, lines } = captureLogger();
    logger.info({ email: syntheticTraveler.email }, "login");
    const raw = lines().join("");
    expect(raw).not.toContain(syntheticTraveler.email);
    expect(raw).toContain("[REDACTED]");
  });

  it("redacts dateOfBirth at top level", () => {
    const { logger, lines } = captureLogger();
    logger.info({ dateOfBirth: syntheticTraveler.dateOfBirth }, "profile");
    const raw = lines().join("");
    expect(raw).not.toContain(syntheticTraveler.dateOfBirth);
  });

  it("redacts passportNumber at top level", () => {
    const { logger, lines } = captureLogger();
    logger.info({ passportNumber: syntheticTraveler.passportNumber }, "profile");
    const raw = lines().join("");
    expect(raw).not.toContain(syntheticTraveler.passportNumber);
  });
});

describe("PII redaction — nested traveler object", () => {
  it("redacts email inside traveler.*", () => {
    const { logger, lines } = captureLogger();
    logger.info({ traveler: syntheticTraveler }, "offer");
    const raw = lines().join("");
    expect(raw).not.toContain(syntheticTraveler.email);
  });

  it("redacts dateOfBirth inside traveler.*", () => {
    const { logger, lines } = captureLogger();
    logger.info({ traveler: syntheticTraveler }, "offer");
    const raw = lines().join("");
    expect(raw).not.toContain(syntheticTraveler.dateOfBirth);
  });

  it("redacts passportNumber inside traveler.*", () => {
    const { logger, lines } = captureLogger();
    logger.info({ traveler: syntheticTraveler }, "offer");
    const raw = lines().join("");
    expect(raw).not.toContain(syntheticTraveler.passportNumber);
  });
});

describe("PII redaction — HTTP headers", () => {
  it("redacts authorization header", () => {
    const { logger, lines } = captureLogger();
    logger.info({ headers: syntheticHeaderSet }, "request");
    const raw = lines().join("");
    expect(raw).not.toContain(syntheticHeaderSet["authorization"]);
  });

  it("redacts stripe-signature header", () => {
    const { logger, lines } = captureLogger();
    logger.info({ headers: syntheticHeaderSet }, "webhook");
    const raw = lines().join("");
    expect(raw).not.toContain(syntheticHeaderSet["stripe-signature"]);
  });

  it("does NOT redact safe headers like content-type", () => {
    const { logger, lines } = captureLogger();
    logger.info({ headers: syntheticHeaderSet }, "safe-header");
    const record = parseLastLine(lines());
    const headers = record["headers"] as Record<string, string> | undefined;
    expect(headers?.["content-type"]).toBe("application/json");
  });
});

describe("PII redaction — passenger arrays", () => {
  it("redacts email in all passengers", () => {
    const { logger, lines } = captureLogger();
    logger.info({ passengers: syntheticPassengers }, "booking");
    const raw = lines().join("");
    for (const p of syntheticPassengers) {
      expect(raw).not.toContain(p.email);
      expect(raw).not.toContain(p.passportNumber);
    }
  });
});

describe("PII redaction — Error stack scrubbing", () => {
  it("scrubs email from error message and stack", () => {
    const { logger, lines } = captureLogger();
    logger.error({ err: syntheticPiiError }, "auth failure");
    const raw = lines().join("");
    expect(raw).not.toContain("test.person@example-travel.com");
  });
});

// ─── Integration smoke test ────────────────────────────────────────────────────

describe("createLogger integration", () => {
  it("returns a Pino logger with info method", () => {
    const logger = createLogger({ service: "smoke-test" });
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.child).toBe("function");
  });
});
