import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Express, raw } from "express";
import request from "supertest";
import { z } from "zod";
import {
  FlightSearchRequestSchema,
  HotelSearchRequestSchema,
  CarRentalSearchRequestSchema,
} from "@travel/contracts/search";
import { ErrorCode } from "@travel/contracts";
import { validateRequest } from "@travel/shared";

// ─── Future-date fixtures ─────────────────────────────────────────────────────

const validFlightSearchBody = {
  origin: "JFK",
  destination: "LHR",
  departureDate: "2099-06-15",
  returnDate: "2099-06-22",
  passengers: 2,
  seatClass: "ECONOMY",
  currency: "USD",
};

const validHotelSearchBody = {
  destination: "Paris, France",
  checkInDate: "2099-07-01",
  checkOutDate: "2099-07-05",
  guests: 2,
  currency: "EUR",
};

const validCarSearchBody = {
  pickupLocation: "London Heathrow Airport",
  dropoffLocation: "London City Airport",
  pickupDate: "2099-08-01",
  dropoffDate: "2099-08-07",
  carClass: "MIDSIZE",
  currency: "GBP",
};

const TRACE_ID = "corr_01J9X0Y2Z3A4B5C6D7E8F9G0";

// ─── Route audit helper ───────────────────────────────────────────────────────

interface RouteDefinition {
  method: string;
  path: string;
  usesValidation: boolean;
}

/**
 * Audits an Express app's route stack to detect routes that lack validateRequest
 * middleware. Health endpoints (/health/live, /health/ready) are exempt.
 */
export function auditRoutes(app: Express): RouteDefinition[] {
  const routes: RouteDefinition[] = [];

  function walk(stack: express.Router["stack"], prefix = ""): void {
    for (const layer of stack) {
      if (layer.route) {
        const route = layer.route;
        const path = prefix + route.path;
        const isHealthRoute =
          path === "/health/live" ||
          path === "/health/ready" ||
          path.endsWith("/health/live") ||
          path.endsWith("/health/ready");

        for (const method of Object.keys(route.methods)) {
          if (!route.methods[method]) continue;
          const handlers = route.stack.map((h) => h.handle);
          const usesValidation = handlers.some(
            (h) => h.name === "validateRequest" || h.toString().includes("parsedBody"),
          );
          routes.push({
            method: method.toUpperCase(),
            path,
            usesValidation: isHealthRoute || usesValidation,
          });
        }
      } else if (layer.name === "router" && "handle" in layer && layer.handle?.stack) {
        const mountPath =
          "regexp" in layer && layer.regexp
            ? prefix
            : prefix;
        walk(layer.handle.stack, mountPath);
      }
    }
  }

  walk(app._router.stack);
  return routes;
}

export function findUnvalidatedRoutes(app: Express): RouteDefinition[] {
  return auditRoutes(app).filter((r) => !r.usesValidation);
}

// ─── Test app factory ─────────────────────────────────────────────────────────

function createFlightSearchApp(supplierSpy: ReturnType<typeof vi.fn>): Express {
  const app = express();
  app.use(express.json());

  const validateFlightSearch = validateRequest({ body: FlightSearchRequestSchema });

  app.post("/flights/search", validateFlightSearch, (_req, res) => {
    supplierSpy();
    res.status(200).json({ offers: [] });
  });

  return app;
}

function createHotelSearchApp(): Express {
  const app = express();
  app.use(express.json());

  const validateHotelSearch = validateRequest({ body: HotelSearchRequestSchema });

  app.post("/hotels/search", validateHotelSearch, (_req, res) => {
    res.status(200).json({ offers: [] });
  });

  return app;
}

function createCarSearchApp(): Express {
  const app = express();
  app.use(express.json());

  const validateCarSearch = validateRequest({ body: CarRentalSearchRequestSchema });

  app.post("/cars/search", validateCarSearch, (_req, res) => {
    res.status(200).json({ offers: [] });
  });

  return app;
}

function createWebhookApp(): Express {
  const app = express();

  app.post(
    "/payments/webhook",
    raw({ type: "application/json" }),
    (req, res) => {
      res.status(200).json({ received: true, bodyType: typeof req.body });
    },
  );

  return app;
}

function createParsedBodyApp(): Express {
  const app = express();
  app.use(express.json());

  const validateFlightSearch = validateRequest({ body: FlightSearchRequestSchema });

  app.post("/flights/search", validateFlightSearch, (req, res) => {
    res.status(200).json({ parsedBody: req.parsedBody });
  });

  return app;
}

function createUnvalidatedApp(): Express {
  const app = express();
  app.use(express.json());

  // Deliberately no validateRequest middleware — audit anti-pattern
  app.post("/flights/search", (_req, res) => {
    res.status(200).json({ offers: [] });
  });

  app.get("/health/live", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("validateRequest middleware", () => {
  let supplierSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    supplierSpy = vi.fn();
  });

  // Test 1: Valid flight search body passes through (200)
  it("returns 200 for a valid flight search body", async () => {
    const app = createFlightSearchApp(supplierSpy);

    const res = await request(app)
      .post("/flights/search")
      .send(validFlightSearchBody);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ offers: [] });
    expect(supplierSpy).toHaveBeenCalledOnce();
  });

  // Test 2: Invalid IATA code returns 400 with BR-11 message and field=origin
  it("returns 400 with BR-11 message for a 4-letter IATA code and does not call supplier", async () => {
    const app = createFlightSearchApp(supplierSpy);

    const res = await request(app)
      .post("/flights/search")
      .send({ ...validFlightSearchBody, origin: "JFKK" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(res.body.error.field).toBe("origin");
    expect(res.body.error.message).toMatch(/3-letter IATA code/i);
    expect(supplierSpy).not.toHaveBeenCalled();
  });

  // Test 3: Hotel check-out <= check-in returns 400 with field=checkOutDate
  it("returns 400 when hotel check-out is on or before check-in", async () => {
    const app = createHotelSearchApp();

    const res = await request(app)
      .post("/hotels/search")
      .send({ ...validHotelSearchBody, checkInDate: "2099-07-05", checkOutDate: "2099-07-01" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(res.body.error.field).toBe("checkOutDate");
    expect(res.body.error.message).toMatch(/check-out date must be strictly after/i);
  });

  // Test 4: Car drop-off <= pick-up returns 400 with field=dropoffDate
  it("returns 400 when car drop-off is on or before pick-up", async () => {
    const app = createCarSearchApp();

    const res = await request(app)
      .post("/cars/search")
      .send({ ...validCarSearchBody, pickupDate: "2099-08-07", dropoffDate: "2099-08-01" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(res.body.error.field).toBe("dropoffDate");
    expect(res.body.error.message).toMatch(/drop-off date must be strictly after/i);
  });

  // Test 5: Stripe webhook route passes through without validation middleware
  it("allows Stripe webhook to receive raw body without validateRequest", async () => {
    const app = createWebhookApp();

    const payload = JSON.stringify({ type: "payment_intent.succeeded", id: "evt_123" });

    const res = await request(app)
      .post("/payments/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=123,v1=abc")
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body.bodyType).toBe("object");
  });

  // Test 6: Unknown keys in body are handled gracefully (stripped, request succeeds)
  it("strips unknown keys and still returns 200", async () => {
    const app = createFlightSearchApp(supplierSpy);

    const res = await request(app)
      .post("/flights/search")
      .send({ ...validFlightSearchBody, unknownField: "should-be-stripped" });

    expect(res.status).toBe(200);
    expect(supplierSpy).toHaveBeenCalledOnce();
  });

  // Test 7: Middleware attaches parsedBody on success
  it("attaches parsedBody with validated and transformed values", async () => {
    const app = createParsedBodyApp();

    const res = await request(app)
      .post("/flights/search")
      .send({ ...validFlightSearchBody, origin: "jfk" });

    expect(res.status).toBe(200);
    expect(res.body.parsedBody).toBeDefined();
    expect(res.body.parsedBody.origin).toBe("JFK");
    expect(res.body.parsedBody.destination).toBe("LHR");
    expect(res.body.parsedBody.passengers).toBe(2);
  });

  // Test 8: Reference is present in error envelope
  it("includes trace reference in the error envelope", async () => {
    const app = createFlightSearchApp(supplierSpy);

    const res = await request(app)
      .post("/flights/search")
      .set("x-correlation-id", TRACE_ID)
      .send({ ...validFlightSearchBody, origin: "JFKK" });

    expect(res.status).toBe(400);
    expect(res.body.reference).toBe(TRACE_ID);
  });

  // Test 9: Route without middleware — audit test pattern
  it("detects routes lacking validateRequest via audit helper", async () => {
    const app = createUnvalidatedApp();

    // Invalid payload passes through because no validation middleware is applied
    const res = await request(app)
      .post("/flights/search")
      .send({ origin: "JFKK" });

    expect(res.status).toBe(200);

    const unvalidated = findUnvalidatedRoutes(app);
    const flightSearch = unvalidated.find(
      (r) => r.method === "POST" && r.path === "/flights/search",
    );
    expect(flightSearch).toBeDefined();
    expect(flightSearch?.usesValidation).toBe(false);

    const healthLive = auditRoutes(app).find(
      (r) => r.method === "GET" && r.path === "/health/live",
    );
    expect(healthLive?.usesValidation).toBe(true);
  });

  it("does not mutate req.body — raw body remains intact", async () => {
    const app = express();
    app.use(express.json());

    const validateFlightSearch = validateRequest({ body: FlightSearchRequestSchema });

    app.post("/flights/search", validateFlightSearch, (req, res) => {
      res.status(200).json({
        rawOrigin: req.body.origin,
        parsedOrigin: (req.parsedBody as { origin: string }).origin,
      });
    });

    const res = await request(app)
      .post("/flights/search")
      .send({ ...validFlightSearchBody, origin: "jfk" });

    expect(res.status).toBe(200);
    expect(res.body.rawOrigin).toBe("jfk");
    expect(res.body.parsedOrigin).toBe("JFK");
  });

  it("validates query, params, and headers when schemas are provided", async () => {
    const app = express();
    app.use(express.json());

    const validate = validateRequest({
      query: z.object({ page: z.coerce.number().int().min(1) }),
      params: z.object({ id: z.string().uuid() }),
      headers: z.object({ "x-api-key": z.string().min(1) }),
    });

    app.get("/items/:id", validate, (req, res) => {
      res.status(200).json({
        parsedQuery: req.parsedQuery,
        parsedParams: req.parsedParams,
        parsedHeaders: req.parsedHeaders,
      });
    });

    const res = await request(app)
      .get("/items/550e8400-e29b-41d4-a716-446655440000?page=2")
      .set("x-api-key", "secret-key");

    expect(res.status).toBe(200);
    expect(res.body.parsedQuery).toEqual({ page: 2 });
    expect(res.body.parsedParams).toEqual({ id: "550e8400-e29b-41d4-a716-446655440000" });
  });
});
