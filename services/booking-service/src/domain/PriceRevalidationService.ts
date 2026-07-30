/**
 * PriceRevalidationService — supplier price re-validation before payment.
 *
 * WO-042: Before charging the traveler, re-fetch the live price from the supplier
 * and compare against the frozen offer_snapshot. If prices diverge beyond the
 * tolerance threshold, surface a PriceChangedError requiring explicit traveler
 * re-acceptance.
 *
 * Acceptance criteria:
 * - If live price ≤ snapshot price: proceed (we always honor the quoted price)
 * - If live price > snapshot price by ≤ 1%: proceed (within tolerance)
 * - If live price > snapshot price by > 1%: raise PriceChangedError
 * - Supplier unavailable: configurable fail-open or fail-closed
 */

export class PriceChangedError extends Error {
  constructor(
    public readonly offerId: string,
    public readonly quotedPrice: number,
    public readonly livePrice: number,
    public readonly currency: string,
  ) {
    super(
      `Price for offer ${offerId} changed from ${currency} ${quotedPrice} to ${livePrice}. ` +
        "Please re-confirm to proceed.",
    );
    this.name = "PriceChangedError";
  }
}

export class SupplierRevalidationUnavailableError extends Error {
  constructor(public readonly offerId: string) {
    super(`Cannot re-validate offer ${offerId}: supplier unavailable`);
    this.name = "SupplierRevalidationUnavailableError";
  }
}

export interface LivePricePort {
  getLivePrice(
    offerId: string,
    provenance: string,
  ): Promise<{ amount: number; currency: string } | null>;
}

export interface PriceRevalidationConfig {
  tolerancePct: number; // e.g. 0.01 = 1%
  failOpenOnUnavailable: boolean;
}

export class PriceRevalidationService {
  constructor(
    private readonly livePricePort: LivePricePort,
    private readonly config: PriceRevalidationConfig = {
      tolerancePct: 0.01,
      failOpenOnUnavailable: false,
    },
  ) {}

  async validate(input: {
    offerId: string;
    provenance: string;
    snapshotPrice: number;
    currency: string;
  }): Promise<{ valid: true } | { valid: false; reason: "price_changed" | "unavailable" }> {
    const live = await this.livePricePort.getLivePrice(
      input.offerId,
      input.provenance,
    );

    if (!live) {
      if (this.config.failOpenOnUnavailable) {
        return { valid: true };
      }
      throw new SupplierRevalidationUnavailableError(input.offerId);
    }

    // Price drop or same: always ok (honor quoted price)
    if (live.amount <= input.snapshotPrice) return { valid: true };

    // Check tolerance
    const increase = (live.amount - input.snapshotPrice) / input.snapshotPrice;
    if (increase <= this.config.tolerancePct) return { valid: true };

    throw new PriceChangedError(
      input.offerId,
      input.snapshotPrice,
      live.amount,
      input.currency,
    );
  }
}
