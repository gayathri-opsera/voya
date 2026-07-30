"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "../../components/ui/Button.js";
import { Input } from "../../components/ui/Input.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card.js";
import { Skeleton } from "../../components/ui/Skeleton.js";
import { useToast } from "../../components/ui/Toast.js";
import { apiGet, apiPost } from "../../lib/api/client.js";
import { ApiError } from "../../lib/api/errors.js";

type CheckoutStep = "review" | "traveler" | "payment" | "confirmation";

interface Offer {
  id: string;
  type: string;
  title: string;
  price: number;
  currency: string;
  expiresAt: string;
  bookable: boolean;
}

interface TravelerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
}

interface BookingResult {
  bookingId: string;
  clientSecret: string;
}

function StepIndicator({ current, steps }: { current: CheckoutStep; steps: CheckoutStep[] }) {
  const labels: Record<CheckoutStep, string> = {
    review: "Review",
    traveler: "Traveler",
    payment: "Payment",
    confirmation: "Confirmation",
  };
  const currentIdx = steps.indexOf(current);
  return (
    <nav aria-label="Checkout steps" className="flex items-center gap-2 mb-6">
      {steps.map((step, idx) => (
        <React.Fragment key={step}>
          <div
            className={`flex items-center gap-1.5 text-sm font-medium ${
              idx < currentIdx
                ? "text-brand-600"
                : idx === currentIdx
                ? "text-brand-500"
                : "text-text-tertiary"
            }`}
            aria-current={step === current ? "step" : undefined}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 ${
                idx < currentIdx
                  ? "bg-brand-500 border-brand-500 text-white"
                  : idx === currentIdx
                  ? "border-brand-500 text-brand-500"
                  : "border-gray-300 text-gray-400"
              }`}
            >
              {idx < currentIdx ? "✓" : idx + 1}
            </span>
            {labels[step]}
          </div>
          {idx < steps.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
        </React.Fragment>
      ))}
    </nav>
  );
}

const STEPS: CheckoutStep[] = ["review", "traveler", "payment", "confirmation"];

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const offerId = searchParams.get("offerId") ?? "";
  const { addToast } = useToast();

  const [step, setStep] = React.useState<CheckoutStep>("review");
  const [offer, setOffer] = React.useState<Offer | null>(null);
  const [loadingOffer, setLoadingOffer] = React.useState(true);
  const [travelerInfo, setTravelerInfo] = React.useState<TravelerInfo>({
    firstName: "", lastName: "", email: "", phone: "", dateOfBirth: "",
  });
  const [bookingResult, setBookingResult] = React.useState<BookingResult | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<TravelerInfo>>({});

  React.useEffect(() => {
    if (!offerId) return;
    apiGet<Offer>(`/offers/${offerId}`)
      .then(setOffer)
      .catch(() => addToast({ title: "Failed to load offer", variant: "error" }))
      .finally(() => setLoadingOffer(false));
  }, [offerId]);

  async function handleTravelerSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Partial<TravelerInfo> = {};
    if (!travelerInfo.firstName) errs.firstName = "Required";
    if (!travelerInfo.lastName) errs.lastName = "Required";
    if (!travelerInfo.email) errs.email = "Required";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setStep("payment");
  }

  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await apiPost<BookingResult>("/bookings", {
        offerId,
        traveler: travelerInfo,
        idempotencyKey: `checkout_${offerId}_${Date.now()}`,
      });
      setBookingResult(result);
      setStep("confirmation");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "price_changed") {
          addToast({ title: "Price updated", description: "Please review the new price.", variant: "warning" });
          setStep("review");
          apiGet<Offer>(`/offers/${offerId}`).then(setOffer).catch(() => {});
        } else {
          addToast({ title: "Booking failed", description: err.message, variant: "error" });
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!offerId) {
    router.push("/search");
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-text-primary mb-4">Checkout</h1>
      <StepIndicator current={step} steps={STEPS} />

      {step === "review" && (
        <Card variant="elevated">
          <CardHeader><CardTitle>Review your selection</CardTitle></CardHeader>
          <CardContent className="p-4">
            {loadingOffer ? (
              <Skeleton variant="rectangular" height={80} />
            ) : offer ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-text-secondary">{offer.title}</span>
                  <span className="font-bold text-brand-600">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: offer.currency }).format(offer.price)}
                  </span>
                </div>
                <div className="text-xs text-text-tertiary">
                  Offer valid until {new Date(offer.expiresAt).toLocaleString()}
                </div>
                <Button onClick={() => setStep("traveler")} className="w-full">
                  Continue
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {step === "traveler" && (
        <form onSubmit={handleTravelerSubmit}>
          <Card variant="elevated">
            <CardHeader><CardTitle>Traveler information</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="First name" value={travelerInfo.firstName} onChange={(e) => setTravelerInfo((p) => ({ ...p, firstName: e.target.value }))} error={errors.firstName} required />
                <Input label="Last name" value={travelerInfo.lastName} onChange={(e) => setTravelerInfo((p) => ({ ...p, lastName: e.target.value }))} error={errors.lastName} required />
              </div>
              <Input label="Email" type="email" value={travelerInfo.email} onChange={(e) => setTravelerInfo((p) => ({ ...p, email: e.target.value }))} error={errors.email} required />
              <Input label="Phone (optional)" type="tel" value={travelerInfo.phone} onChange={(e) => setTravelerInfo((p) => ({ ...p, phone: e.target.value }))} />
              <Input label="Date of birth (optional)" type="date" value={travelerInfo.dateOfBirth} onChange={(e) => setTravelerInfo((p) => ({ ...p, dateOfBirth: e.target.value }))} />
              <div className="flex gap-2">
                <Button variant="secondary" type="button" onClick={() => setStep("review")}>Back</Button>
                <Button type="submit" className="flex-1">Continue to payment</Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      {step === "payment" && (
        <form onSubmit={handlePaymentSubmit}>
          <Card variant="elevated">
            <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="rounded-md border border-surface-tertiary p-4 bg-surface-secondary text-sm text-text-secondary text-center">
                Stripe Elements will be mounted here.
                <br />
                (Requires Stripe.js integration in production)
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" type="button" onClick={() => setStep("traveler")}>Back</Button>
                <Button type="submit" loading={submitting} className="flex-1">Complete booking</Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      {step === "confirmation" && bookingResult && (
        <Card variant="elevated">
          <CardContent className="p-6 text-center space-y-4">
            <div className="text-4xl">✅</div>
            <h2 className="text-xl font-bold text-text-primary">Booking confirmed!</h2>
            <p className="text-text-secondary">
              Your booking reference is <strong>{bookingResult.bookingId}</strong>.
            </p>
            <Button as="a" href="/itineraries">View my itineraries</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
