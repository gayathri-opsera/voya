"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/Card.js";
import { Badge } from "../../../components/ui/Badge.js";
import { Button } from "../../../components/ui/Button.js";
import { Skeleton } from "../../../components/ui/Skeleton.js";
import { EmptyState } from "../../../components/ui/EmptyState.js";
import { apiGet } from "../../../lib/api/client.js";
import { ApiError } from "../../../lib/api/errors.js";

interface Listing {
  id: string;
  type: "flight" | "hotel" | "car";
  provenance: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  expiresAt: string;
  bookable: boolean;
  details: Record<string, unknown>;
  availability: {
    available: boolean;
    remainingSpots?: number;
  };
  reviews?: { rating: number; count: number };
}

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Rating: ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-4 h-4 ${star <= Math.round(rating) ? "text-yellow-400" : "text-gray-300"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-sm text-text-secondary ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function ListingDetailPage() {
  const params = useParams();
  const offerId = params.id as string;
  const [listing, setListing] = React.useState<Listing | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiGet<Listing>(`/offers/${offerId}`)
      .then(setListing)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("This listing is no longer available.");
        } else {
          setError("Failed to load listing. Please try again.");
        }
      })
      .finally(() => setLoading(false));
  }, [offerId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
        <Skeleton variant="rectangular" height={300} className="rounded-xl" />
        <Skeleton variant="text" />
        <Skeleton variant="text" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState title="Listing not found" description={error ?? "Unknown error"} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center gap-2">
        <Badge variant={listing.type === "flight" ? "info" : listing.type === "hotel" ? "success" : "warning"}>
          {listing.type}
        </Badge>
        {listing.provenance === "ILLUSTRATIVE" && (
          <Badge variant="outline">Sample listing</Badge>
        )}
        {!listing.availability.available && (
          <Badge variant="error">Unavailable</Badge>
        )}
      </div>

      <h1 className="text-2xl font-bold text-text-primary mb-2">{listing.title}</h1>

      {listing.reviews && (
        <div className="flex items-center gap-2 mb-4">
          <StarRating rating={listing.reviews.rating} />
          <span className="text-sm text-text-secondary">({listing.reviews.count} reviews)</span>
        </div>
      )}

      <p className="text-text-secondary mb-6">{listing.description}</p>

      <Card variant="elevated" className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-brand-600">
                {formatPrice(listing.price, listing.currency)}
              </div>
              <div className="text-sm text-text-secondary mt-0.5">per person</div>
              {listing.availability.remainingSpots !== undefined && (
                <div className="text-sm text-warning mt-1">
                  Only {listing.availability.remainingSpots} spots left!
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                disabled={!listing.availability.available || !listing.bookable}
                as="a"
                href={`/checkout?offerId=${listing.id}`}
                size="lg"
              >
                Book now
              </Button>
              {!listing.bookable && (
                <p className="text-xs text-text-secondary text-center">Not available for booking</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {Object.keys(listing.details).length > 0 && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              {Object.entries(listing.details).map(([key, value]) => (
                <React.Fragment key={key}>
                  <dt className="text-sm font-medium text-text-secondary capitalize">
                    {key.replace(/_/g, " ")}
                  </dt>
                  <dd className="text-sm text-text-primary">{String(value)}</dd>
                </React.Fragment>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
