/**
 * RapidAPI car rental supplier adapter — WO-028.
 */

import type { SupplierPort } from "@travel/supplier-port";
import type { NormalisedOffer } from "@travel/contracts/search";
import type { SearchCriteria } from "./AmadeusFlightAdapter.js";

export interface RapidApiCarConfig {
  apiKey: string;
  baseUrl: string;
}

export class RapidApiCarAdapter implements Pick<SupplierPort, "name" | "flowShape" | "searchOffers"> {
  readonly name = "RAPIDAPI_CAR";
  readonly flowShape = "INSTANT" as const;

  constructor(private readonly config: RapidApiCarConfig) {}

  async searchOffers(criteria: SearchCriteria): Promise<NormalisedOffer[]> {
    const params = new URLSearchParams({
      pickup_location: criteria.destination,
      pickup_date: criteria.departureDate,
      currency: criteria.currency,
      limit: "10",
    });

    const res = await fetch(`${this.config.baseUrl}/cars/search?${params}`, {
      headers: {
        "X-RapidAPI-Key": this.config.apiKey,
        "X-RapidAPI-Host": "cars-rental.p.rapidapi.com",
      },
    });

    if (res.status === 429) throw new Error("RapidAPI car rate limit exceeded");
    if (!res.ok) throw new Error(`RapidAPI car search failed: ${res.status}`);

    const data = await res.json() as { vehicles: unknown[] };
    return (data.vehicles ?? []).map((car) =>
      this.normalise(car as Record<string, unknown>, criteria),
    );
  }

  private normalise(raw: Record<string, unknown>, criteria: SearchCriteria): NormalisedOffer {
    const price = raw.price as Record<string, unknown> ?? {};
    return {
      id: `rapidapi-car-${raw.id}`,
      type: "car",
      provenance: "RAPIDAPI_CAR",
      bookable: true,
      freshness: "LIVE",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      price: {
        amount: parseFloat(String(price.amount ?? 0)),
        currency: criteria.currency,
        breakdown: [],
      },
      summary: {
        category: raw.category as string ?? "ECONOMY",
        vendor: raw.vendor as string ?? "Unknown",
        pickupLocation: criteria.destination,
        pickupDate: criteria.departureDate,
      },
      rawPayload: raw,
    } as unknown as NormalisedOffer;
  }
}
