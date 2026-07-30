import { describe, it, expect, vi } from "vitest";
import { bookableFlightOffer, illustrativeHotelOffer } from "../fixtures/search-response";

/**
 * Tests the non-bookable offer guard logic.
 * The guard ensures ILLUSTRATIVE offers cannot initiate a checkout action.
 */

function isOfferBookable(offer: { bookable: boolean; provenance: string }): boolean {
  return offer.bookable && offer.provenance !== "ILLUSTRATIVE";
}

function attemptCheckout(
  offer: { bookable: boolean; provenance: string; id: string },
  onBook: (id: string) => void,
): void {
  if (!isOfferBookable(offer)) return;
  onBook(offer.id);
}

describe("Offer bookable guard", () => {
  it("allows booking for an AMADEUS bookable offer", () => {
    const onBook = vi.fn();
    attemptCheckout(bookableFlightOffer, onBook);
    expect(onBook).toHaveBeenCalledWith(bookableFlightOffer.id);
  });

  it("blocks booking for an ILLUSTRATIVE non-bookable offer", () => {
    const onBook = vi.fn();
    attemptCheckout(illustrativeHotelOffer, onBook);
    expect(onBook).not.toHaveBeenCalled();
  });

  it("returns false for isOfferBookable on ILLUSTRATIVE offer", () => {
    expect(isOfferBookable(illustrativeHotelOffer)).toBe(false);
  });

  it("returns false for isOfferBookable when bookable=false regardless of provenance", () => {
    expect(isOfferBookable({ bookable: false, provenance: "AMADEUS" })).toBe(false);
  });

  it("returns true for isOfferBookable for AMADEUS bookable offer", () => {
    expect(isOfferBookable(bookableFlightOffer)).toBe(true);
  });

  it("returns true for isOfferBookable for RAPIDAPI bookable offer", () => {
    expect(isOfferBookable({ bookable: true, provenance: "RAPIDAPI" })).toBe(true);
  });
});
