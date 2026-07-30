import type { UnifiedOffer } from "@travel/contracts/search";

interface OfferCardProps {
  offer: UnifiedOffer;
  onBook?: (offerId: string) => void;
}

/**
 * Renders an offer card. ILLUSTRATIVE offers are structurally non-bookable:
 * the book action is disabled and unreachable regardless of UI state.
 */
export function OfferCard({ offer, onBook }: OfferCardProps): React.JSX.Element {
  const isBookable = offer.bookable && offer.provenance !== "ILLUSTRATIVE";

  const handleBook = (): void => {
    if (!isBookable) return;
    onBook?.(offer.id);
  };

  return (
    <div
      data-testid="offer-card"
      data-provenance={offer.provenance}
      data-bookable={String(offer.bookable)}
    >
      <h3>{offer.title}</h3>
      <p>
        {offer.price} {offer.currency}
      </p>
      <span data-testid="freshness-label">{offer.freshness}</span>

      {!isBookable && (
        <span data-testid="non-bookable-label" aria-label="Not available for booking">
          Sample offer — not available for booking
        </span>
      )}

      <button
        onClick={handleBook}
        disabled={!isBookable}
        aria-disabled={!isBookable}
        data-testid="book-button"
      >
        {isBookable ? "Book now" : "Unavailable"}
      </button>
    </div>
  );
}

export default OfferCard;
