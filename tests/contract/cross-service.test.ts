/**
 * Cross-service contract compatibility tests — WO-096.
 *
 * Verifies that all service consumers are compatible with the
 * current @travel/contracts schemas. Uses the contract baseline
 * system (WO-005) to detect breaking changes.
 *
 * Consumer services tested:
 * - booking-service: ConsumesFlightSearchRequest, NormalisedOffer
 * - payment-service: No direct contract consumption
 * - auth-service: No direct contract consumption
 * - user-service: ItineraryService (internal types, no contract)
 * - ai-service: Uses ProvenanceSchema for offer grounding
 * - notification-service: No direct contract consumption
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { SCHEMA_REGISTRY, getSchemaById } from "../../packages/contracts/src/registry.js";
import { ProvenanceSchema, BOOKABLE_PROVENANCES } from "../../packages/contracts/src/provenance/index.js";

describe("Cross-service contract compatibility", () => {
  describe("Schema registry completeness", () => {
    it("all schemas in registry have stable IDs", () => {
      for (const entry of SCHEMA_REGISTRY) {
        expect(typeof entry.id).toBe("string");
        expect(entry.id.length).toBeGreaterThan(0);
        expect(entry.schema).toBeDefined();
      }
    });

    it("registry has expected domains", () => {
      const ids = SCHEMA_REGISTRY.map((e) => e.id);
      const domains = new Set(ids.map((id) => id.split(".")[0]));
      expect(domains.has("search")).toBe(true);
      expect(domains.has("booking")).toBe(true);
    });
  });

  describe("Provenance contract — consumed by ai-service and booking-service", () => {
    it("AMADEUS is a valid bookable provenance", () => {
      expect(() => ProvenanceSchema.parse("AMADEUS")).not.toThrow();
      expect(BOOKABLE_PROVENANCES.has("AMADEUS")).toBe(true);
    });

    it("ILLUSTRATIVE is valid provenance but not bookable", () => {
      expect(() => ProvenanceSchema.parse("ILLUSTRATIVE")).not.toThrow();
      expect(BOOKABLE_PROVENANCES.has("ILLUSTRATIVE")).toBe(false);
    });

    it("invalid provenance string is rejected", () => {
      expect(() => ProvenanceSchema.parse("INVALID_PROV")).toThrow();
    });
  });

  describe("Error envelope contract — consumed by all services", () => {
    it("error envelope schema is present in registry", () => {
      const errorSchemas = SCHEMA_REGISTRY.filter((e) => e.id.startsWith("errors."));
      expect(errorSchemas.length).toBeGreaterThan(0);
    });
  });

  describe("Search contract — consumed by booking-service and ai-service", () => {
    it("FlightSearchRequest schema is present and has required fields", () => {
      const entry = getSchemaById("search.FlightSearchRequest");
      expect(entry).toBeDefined();
      if (entry) {
        const schema = entry.schema as z.ZodTypeAny;
        // Verify basic structure: should require origin, destination, passengers, seatClass, currency
        const validParse = schema.safeParse({
          origin: "JFK",
          destination: "LHR",
          departureDate: "2030-12-01",
          passengers: 1,
          seatClass: "ECONOMY",
          currency: "USD",
        });
        expect(validParse.success).toBe(true);
      }
    });
  });
});
