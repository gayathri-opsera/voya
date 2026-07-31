"use client";

/**
 * Traveler account dashboard — WO-069.
 * Shows upcoming trips, past bookings, and quick-action links.
 */

import { useEffect, useState } from "react";

interface Booking {
  id: string;
  status: string;
  offerSnapshot: { type: string; summary: Record<string, string>; price: { amount: number; currency: string } };
  createdAt: string;
}

interface DashboardData {
  upcoming: Booking[];
  past: Booking[];
  totalTrips: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/bookings?limit=20")
      .then((r) => r.json())
      .then((bookings: Booking[]) => {
        const now = new Date();
        const upcoming = bookings.filter(
          (b) => b.status === "CONFIRMED" && new Date(b.offerSnapshot?.summary?.departureDate ?? 0) > now,
        );
        const past = bookings.filter((b) => b.status === "CONFIRMED" && !upcoming.includes(b));
        setData({ upcoming, past, totalTrips: bookings.length });
      })
      .catch(() => setError("Failed to load your dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Trips</h1>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Trips" value={data?.totalTrips ?? 0} />
          <StatCard label="Upcoming" value={data?.upcoming.length ?? 0} highlight />
          <StatCard label="Completed" value={data?.past.length ?? 0} />
        </div>

        {/* Upcoming trips */}
        <Section title="Upcoming Trips">
          {data?.upcoming.length === 0 ? (
            <EmptyState message="No upcoming trips. Start planning your next adventure!" cta={{ label: "Search Flights", href: "/search" }} />
          ) : (
            data?.upcoming.map((b) => <BookingCard key={b.id} booking={b} />)
          )}
        </Section>

        {/* Past trips */}
        {(data?.past.length ?? 0) > 0 && (
          <Section title="Past Trips">
            {data?.past.map((b) => <BookingCard key={b.id} booking={b} faded />)}
          </Section>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 text-center shadow-sm ${highlight ? "bg-blue-600 text-white" : "bg-white text-gray-900"}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className={`text-sm mt-1 ${highlight ? "text-blue-100" : "text-gray-500"}`}>{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function BookingCard({ booking, faded = false }: { booking: Booking; faded?: boolean }) {
  const { type, summary, price } = booking.offerSnapshot;
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm flex justify-between items-center ${faded ? "opacity-60" : ""}`}>
      <div>
        <p className="font-medium text-gray-900 capitalize">{type} — {summary.origin ?? summary.name ?? summary.destination}</p>
        <p className="text-sm text-gray-500">{summary.departureDate ?? summary.checkin ?? "—"}</p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-blue-600">{price.currency} {price.amount.toFixed(2)}</p>
        <span className={`text-xs px-2 py-0.5 rounded-full ${booking.status === "CONFIRMED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {booking.status}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ message, cta }: { message: string; cta: { label: string; href: string } }) {
  return (
    <div className="bg-white rounded-xl p-8 text-center">
      <p className="text-gray-500 mb-4">{message}</p>
      <a href={cta.href} className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
        {cta.label}
      </a>
    </div>
  );
}
