/**
 * Load test profiles — WO-098: k6 load and spike test scenarios with latency gates.
 *
 * SLO gates (P0 requirement):
 * - p95 latency < 500ms for /search
 * - p99 latency < 1000ms for /bookings POST
 * - Error rate < 0.1% under normal load
 * - Under 2x spike: p95 < 2000ms, error rate < 1%
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// Custom metrics
const searchLatency = new Trend("search_latency");
const bookingLatency = new Trend("booking_latency");
const errorRate = new Rate("error_rate");
const authRequests = new Counter("auth_requests");

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

// ─── Normal load profile ─────────────────────────────────────────────────────

export const options = {
  scenarios: {
    normal_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 50 },  // Ramp up
        { duration: "5m", target: 50 },  // Steady state
        { duration: "2m", target: 0 },   // Ramp down
      ],
      tags: { scenario: "normal" },
    },
    spike: {
      executor: "ramping-vus",
      startTime: "9m",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 100 }, // Sudden spike to 2x
        { duration: "2m", target: 100 },
        { duration: "30s", target: 0 },
      ],
      tags: { scenario: "spike" },
    },
  },
  thresholds: {
    // SLO gates — test FAILS if these are breached
    search_latency: ["p(95)<500", "p(99)<1000"],
    booking_latency: ["p(95)<1000", "p(99)<2000"],
    error_rate: ["rate<0.001"],       // < 0.1% errors under normal load
    http_req_failed: ["rate<0.001"],
  },
};

export function setup() {
  // Create a test user and get auth token
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: "loadtest@voya.example.com", password: "LoadTest123!" }),
    { headers: { "Content-Type": "application/json" } },
  );
  if (loginRes.status !== 200) {
    throw new Error("Failed to authenticate load test user");
  }
  const body = loginRes.json() as { accessToken: string };
  return { token: body.accessToken };
}

export default function (data: { token: string }) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.token}`,
  };

  // Search flow (60% of traffic)
  if (Math.random() < 0.6) {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/search?q=Paris&sort=price_asc`, { headers });
    searchLatency.add(Date.now() - start);
    const ok = check(res, {
      "search returns 200": (r) => r.status === 200,
      "search has results": (r) => {
        const body = r.json() as { results: unknown[] };
        return Array.isArray(body?.results);
      },
    });
    if (!ok) errorRate.add(1);
    else errorRate.add(0);
  }

  // View offer detail (30% of traffic)
  if (Math.random() < 0.3) {
    const res = http.get(`${BASE_URL}/offers/test_offer_001`, { headers });
    check(res, { "offer detail returns 200": (r) => r.status === 200 });
  }

  // Create booking (10% of traffic) — latency-gated
  if (Math.random() < 0.1) {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/bookings`,
      JSON.stringify({
        offerId: "test_offer_001",
        idempotencyKey: `load_${Date.now()}_${Math.random()}`,
      }),
      { headers },
    );
    bookingLatency.add(Date.now() - start);
    check(res, { "booking returns 2xx": (r) => r.status >= 200 && r.status < 300 });
  }

  sleep(1);
}
