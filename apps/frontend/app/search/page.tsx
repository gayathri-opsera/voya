"use client";
import React, { useState } from "react";
import type { UnifiedOffer } from "@travel/contracts/search";
import type { ErrorEnvelope } from "@travel/contracts";
import { OfferCard } from "@/components/results/OfferCard";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { mapEnvelopeToFormErrors } from "@/lib/errors";

const SEARCH_FIELDS = new Set(["origin", "destination", "departureDate", "passengers", "seatClass", "currency", "destination", "checkInDate", "checkOutDate", "guests"]);

export default function SearchPage(): React.JSX.Element {
  const [offers, setOffers] = useState<UnifiedOffer[]>([]);
  const [error, setError] = useState<ErrorEnvelope | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSearchError = (envelope: ErrorEnvelope): void => {
    const mapped = mapEnvelopeToFormErrors(envelope, SEARCH_FIELDS);
    setError(envelope);
    setFieldErrors(mapped.fieldErrors);
  };

  return (
    <main>
      <h1>Search Flights, Hotels & Cars</h1>
      {error && !fieldErrors[error.error.field ?? ""] && (
        <ErrorBanner envelope={error} />
      )}
      <section data-testid="results">
        {offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </section>
    </main>
  );
}
