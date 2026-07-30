"use client";
import React, { useState } from "react";
import type { ErrorEnvelope } from "@travel/contracts";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

export default function ProfilePage(): React.JSX.Element {
  const [error, setError] = useState<ErrorEnvelope | null>(null);

  return (
    <main>
      <h1>My Profile</h1>
      {error && <ErrorBanner envelope={error} />}
    </main>
  );
}
