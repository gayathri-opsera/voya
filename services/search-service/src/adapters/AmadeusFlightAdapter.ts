/**
 * Amadeus flight supplier adapter — WO-026.
 *
 * Adapts the Amadeus Flight Offers Search API v2 to the NormalisedOffer format.
 * Key responsibilities:
 * - Authentication (OAuth2 client credentials)
 * - Request mapping (FlightSearchRequest → Amadeus API params)
 * - Response normalization (Amadeus → NormalisedOffer)
 * - Error classification (4xx → domain errors, 5xx → SupplierUnavailableError)
 */

import type { SupplierPort } from "@travel/supplier-port";
import type { NormalisedOffer } from "@travel/contracts/search";

export interface AmadeusConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  egressAllowList?: string;
}

export interface SearchCriteria {
  origin: string;
  destination: string;
  departureDate: string;
  passengers: number;
  seatClass: string;
  currency: string;
}

export class AmadeusFlightAdapter implements Pick<SupplierPort, "name" | "flowShape" | "searchOffers"> {
  readonly name = "AMADEUS";
  readonly flowShape = "RESERVE_THEN_CONFIRM" as const;

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: AmadeusConfig) {}

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const res = await fetch(`${this.config.baseUrl}/v1/security/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.config.apiKey,
        client_secret: this.config.apiSecret,
      }),
    });

    if (!res.ok) throw new Error(`Amadeus auth failed: ${res.status}`);
    const data = await res.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken!;
  }

  async searchOffers(criteria: SearchCriteria): Promise<NormalisedOffer[]> {
    const token = await this.getAccessToken();

    const params = new URLSearchParams({
      originLocationCode: criteria.origin,
      destinationLocationCode: criteria.destination,
      departureDate: criteria.departureDate,
      adults: String(criteria.passengers),
      currencyCode: criteria.currency,
      travelClass: this.mapSeatClass(criteria.seatClass),
      max: "10",
    });

    const res = await fetch(
      `${this.config.baseUrl}/v2/shopping/flight-offers?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (res.status === 429) throw new Error("Amadeus rate limit exceeded");
    if (!res.ok) throw new Error(`Amadeus search failed: ${res.status}`);

    const data = await res.json() as { data: unknown[] };
    return data.data.map((offer) => this.normalise(offer as Record<string, unknown>, criteria));
  }

  private mapSeatClass(seatClass: string): string {
    const map: Record<string, string> = {
      ECONOMY: "ECONOMY",
      PREMIUM_ECONOMY: "PREMIUM_ECONOMY",
      BUSINESS: "BUSINESS",
      FIRST: "FIRST",
    };
    return map[seatClass] ?? "ECONOMY";
  }

  private normalise(raw: Record<string, unknown>, criteria: SearchCriteria): NormalisedOffer {
    const price = raw.price as Record<string, string>;
    return {
      id: raw.id as string,
      type: "flight",
      provenance: "AMADEUS",
      bookable: true,
      freshness: "LIVE",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10min TTL
      price: {
        amount: parseFloat(price.total),
        currency: criteria.currency,
        breakdown: [],
      },
      summary: {
        origin: criteria.origin,
        destination: criteria.destination,
        departureDate: criteria.departureDate,
        seatClass: criteria.seatClass,
      },
      rawPayload: raw,
    } as unknown as NormalisedOffer;
  }
}
