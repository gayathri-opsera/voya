"use client";
import React, { useState } from "react";
import type { ErrorEnvelope } from "@travel/contracts";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

export default function CheckoutPage(): React.JSX.Element {
  const [error, setError] = useState<ErrorEnvelope | null>(null);

  return (
    <main>
      <h1>Checkout</h1>
      {error && <ErrorBanner envelope={error} />}
      <p>Select a bookable offer from the search results to continue.</p>
    </main>
  );
}
