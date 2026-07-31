/**
 * RapidAPI hotel supplier adapter — WO-027.
 *
 * Adapts the RapidAPI Hotels v2 endpoint to the NormalisedOffer format.
 */

import type { SupplierPort } from "@travel/supplier-port";
import type { NormalisedOffer } from "@travel/contracts/search";
import type { SearchCriteria } from "./AmadeusFlightAdapter.js";

export interface RapidApiHotelConfig {
  apiKey: string;
  baseUrl: string;
}

export class RapidApiHotelAdapter implements Pick<SupplierPort, "name" | "flowShape" | "searchOffers"> {
  readonly name = "RAPIDAPI_HOTEL";
  readonly flowShape = "INSTANT" as const;

  constructor(private readonly config: RapidApiHotelConfig) {}

  async searchOffers(criteria: SearchCriteria): Promise<NormalisedOffer[]> {
    const params = new URLSearchParams({
      location: criteria.destination,
      checkin: criteria.departureDate,
      adults: String(criteria.passengers),
      currency: criteria.currency,
      limit: "10",
    });

    const res = await fetch(`${this.config.baseUrl}/hotels/search?${params}`, {
      headers: {
        "X-RapidAPI-Key": this.config.apiKey,
        "X-RapidAPI-Host": "hotels4.p.rapidapi.com",
      },
    });

    if (res.status === 429) throw new Error("RapidAPI rate limit exceeded");
    if (!res.ok) throw new Error(`RapidAPI hotel search failed: ${res.status}`);

    const data = await res.json() as { properties: unknown[] };
    return (data.properties ?? []).map((hotel) =>
      this.normalise(hotel as Record<string, unknown>, criteria),
    );
  }

  private normalise(raw: Record<string, unknown>, criteria: SearchCriteria): NormalisedOffer {
    const price = raw.price as Record<string, unknown> ?? {};
    return {
      id: `rapidapi-hotel-${raw.id}`,
      type: "hotel",
      provenance: "RAPIDAPI_HOTEL",
      bookable: true,
      freshness: "LIVE",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      price: {
        amount: parseFloat(String(price.amount ?? 0)),
        currency: criteria.currency,
        breakdown: [],
      },
      summary: {
        name: raw.name as string ?? "Unknown Hotel",
        destination: criteria.destination,
        checkin: criteria.departureDate,
      },
      rawPayload: raw,
    } as unknown as NormalisedOffer;
  }
}
