import { describe, it, expect } from "vitest";
import {
  PriceRevalidationService,
  PriceChangedError,
  SupplierRevalidationUnavailableError,
} from "../../src/domain/PriceRevalidationService.js";

function makeSvc(
  livePrice: { amount: number; currency: string } | null,
  config?: { tolerancePct?: number; failOpenOnUnavailable?: boolean },
) {
  return new PriceRevalidationService(
    { getLivePrice: async () => livePrice },
    { tolerancePct: config?.tolerancePct ?? 0.01, failOpenOnUnavailable: config?.failOpenOnUnavailable ?? false },
  );
}

describe("PriceRevalidationService", () => {
  it("passes when live price equals snapshot", async () => {
    const svc = makeSvc({ amount: 300, currency: "USD" });
    const result = await svc.validate({ offerId: "o1", provenance: "AMADEUS", snapshotPrice: 300, currency: "USD" });
    expect(result.valid).toBe(true);
  });

  it("passes when live price drops below snapshot (honor quoted price)", async () => {
    const svc = makeSvc({ amount: 250, currency: "USD" });
    const result = await svc.validate({ offerId: "o1", provenance: "AMADEUS", snapshotPrice: 300, currency: "USD" });
    expect(result.valid).toBe(true);
  });

  it("passes when price increase is within 1% tolerance", async () => {
    const svc = makeSvc({ amount: 303, currency: "USD" });
    const result = await svc.validate({ offerId: "o1", provenance: "AMADEUS", snapshotPrice: 300, currency: "USD" });
    expect(result.valid).toBe(true);
  });

  it("throws PriceChangedError when increase exceeds 1%", async () => {
    const svc = makeSvc({ amount: 350, currency: "USD" });
    await expect(
      svc.validate({ offerId: "o1", provenance: "AMADEUS", snapshotPrice: 300, currency: "USD" }),
    ).rejects.toThrow(PriceChangedError);
  });

  it("PriceChangedError carries quoted and live amounts", async () => {
    const svc = makeSvc({ amount: 350, currency: "USD" });
    try {
      await svc.validate({ offerId: "offer_x", provenance: "AMADEUS", snapshotPrice: 300, currency: "USD" });
    } catch (err) {
      expect(err).toBeInstanceOf(PriceChangedError);
      const e = err as PriceChangedError;
      expect(e.quotedPrice).toBe(300);
      expect(e.livePrice).toBe(350);
      expect(e.offerId).toBe("offer_x");
    }
  });

  it("throws SupplierRevalidationUnavailableError when fail-closed", async () => {
    const svc = makeSvc(null, { failOpenOnUnavailable: false });
    await expect(
      svc.validate({ offerId: "o1", provenance: "AMADEUS", snapshotPrice: 300, currency: "USD" }),
    ).rejects.toThrow(SupplierRevalidationUnavailableError);
  });

  it("passes through when supplier unavailable and fail-open configured", async () => {
    const svc = makeSvc(null, { failOpenOnUnavailable: true });
    const result = await svc.validate({ offerId: "o1", provenance: "AMADEUS", snapshotPrice: 300, currency: "USD" });
    expect(result.valid).toBe(true);
  });
});
