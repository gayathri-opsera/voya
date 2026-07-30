# GDPR Record of Processing Activities (RoPA)

**Controller:** Marriott Voya (legal entity TBD)  
**Data Protection Officer:** TBD  
**Version:** 0.1 (Draft — WO-100)  
**Last updated:** 2026-07-30  
**Review cycle:** Annual or on material change to processing activities

---

## Data Classification Tiers

| Tier | Examples |
|---|---|
| **Public** | Destination names, flight numbers, hotel names |
| **Internal** | Booking reference IDs, anonymous analytics |
| **Confidential** | Email address, display name, IP address |
| **Restricted** | Date of birth, passport number, payment method identifiers |

---

## Processing Activities

### 1. User Account Registration and Authentication

| Field | Value |
|---|---|
| **Purpose** | Create and manage user identity; authenticate access to travel booking services |
| **Lawful basis** | Contract (Art. 6(1)(b)) — necessary to perform the travel booking contract |
| **Personal data categories** | Email address (Confidential), display name (Confidential), password hash (Confidential) |
| **Data subjects** | Registered platform users |
| **Retention period** | Account lifetime + 30 days after deletion request; auth audit logs 1 year (ASSUMPTION — see Q5) |
| **Storage location** | `services/auth-service` Postgres database (AWS RDS, region: TBD) |
| **Processors** | AWS (infrastructure hosting) |
| **Cross-border transfer basis** | Standard Contractual Clauses (SCCs) — AWS DPA |
| **Automated decision-making** | None |

---

### 2. Travel Search

| Field | Value |
|---|---|
| **Purpose** | Search for available flights, hotels, and car rentals on behalf of the user |
| **Lawful basis** | Contract (Art. 6(1)(b)) |
| **Personal data categories** | Search origin/destination (Internal — non-personal unless combined with identity); IP address (Confidential — via api-gateway logs) |
| **Data subjects** | Authenticated users performing searches |
| **Retention period** | Session duration; structured logs 30 days |
| **Storage location** | Application logs (CloudWatch `/voya/services/*`); no persistent search history stored in phase 1 |
| **Processors** | Amadeus (flight/hotel GDS APIs — see DPA), RapidAPI (aggregator) |
| **Cross-border transfer basis** | SCCs — Amadeus DPA; RapidAPI terms of service |
| **Automated decision-making** | None |

---

### 3. Travel Booking and Itinerary

| Field | Value |
|---|---|
| **Purpose** | Create, store, and manage travel bookings including passenger details required by carriers |
| **Lawful basis** | Contract (Art. 6(1)(b)); Legal obligation (Art. 6(1)(c)) — carrier reporting requirements |
| **Personal data categories** | Full name (Confidential), date of birth (Restricted), passport number (Restricted), email address (Confidential), phone number (Confidential) |
| **Data subjects** | Booking passengers (may differ from account holder) |
| **Retention period** | 7 years from journey completion (ASSUMPTION — US financial record minimum; legal review required — see Q5) |
| **Storage location** | `services/booking-service` Postgres database (AWS RDS) |
| **Processors** | Amadeus (GDS booking), AWS |
| **Cross-border transfer basis** | SCCs — Amadeus DPA |
| **Automated decision-making** | None |

---

### 4. Payment Processing

| Field | Value |
|---|---|
| **Purpose** | Process payment for travel bookings |
| **Lawful basis** | Contract (Art. 6(1)(b)) |
| **Personal data categories** | Stripe Customer ID (Internal — pseudonym), billing email (Confidential); **no PAN, CVV, or card number enters Voya systems** |
| **Data subjects** | Paying customers |
| **Retention period** | Payment audit records 7 years (ASSUMPTION — see Q5); Stripe Customer ID for account lifetime |
| **Storage location** | `services/payment-service` Postgres database (payment intent IDs only); Stripe (card data — outside Voya systems) |
| **Processors** | Stripe (card data processor — Stripe DPA required before production) |
| **Cross-border transfer basis** | SCCs — Stripe DPA |
| **Automated decision-making** | None |

---

### 5. AI Travel Recommendations

| Field | Value |
|---|---|
| **Purpose** | Generate personalised travel recommendations and itinerary suggestions using LLM |
| **Lawful basis** | Legitimate interests (Art. 6(1)(f)) — personalisation; or Consent (Art. 6(1)(a)) if profiling triggers Art. 22 |
| **Personal data categories** | Travel history (Confidential), destination preferences (Internal), natural-language queries (Confidential — may contain personal context) |
| **Data subjects** | Authenticated users opting into recommendation features |
| **Retention period** | Query logs 30 days; preference profiles: account lifetime |
| **Storage location** | `services/ai-orchestration` (query context); Anthropic API (transient — see DPA) |
| **Processors** | Anthropic (LLM inference — DPA required) |
| **Cross-border transfer basis** | SCCs — Anthropic DPA |
| **Automated decision-making** | Recommendations are suggestions only; no automated decisions producing legal/significant effects on data subjects |

---

### 6. Transactional Email

| Field | Value |
|---|---|
| **Purpose** | Send verification emails, booking confirmations, and security notices to users |
| **Lawful basis** | Contract (Art. 6(1)(b)); Legitimate interests (security notices) |
| **Personal data categories** | Email address (Confidential), display name (Confidential) |
| **Data subjects** | Registered users |
| **Retention period** | Email delivery logs 90 days |
| **Storage location** | AWS SES send logs (CloudWatch); no email content stored by Voya |
| **Processors** | AWS SES |
| **Cross-border transfer basis** | SCCs — AWS DPA |
| **Automated decision-making** | None |

---

## Processor DPA Status

| Processor | Role | DPA Status |
|---|---|---|
| AWS | Infrastructure hosting, SES, CloudWatch | Existing — AWS DPA accepted |
| Stripe | Card data processor | REQUIRED before production |
| Amadeus | GDS flight/hotel data | REQUIRED before production |
| RapidAPI | API aggregation | REQUIRED before production |
| Anthropic | LLM inference | REQUIRED before production |

---

## Open Questions

See [pci-scope-decision-record.md](./pci-scope-decision-record.md) Q5 for retention period legal review.
