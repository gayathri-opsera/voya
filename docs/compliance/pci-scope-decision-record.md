# PCI-DSS Self-Assessment Tier — Decision Record

| Field | Value |
|---|---|
| **Status** | DRAFT — Pending sign-off |
| **Decision date** | _To be recorded on ratification_ |
| **Review cycle** | Annual or on material architectural change |
| **Decision ID** | PCI-DR-001 |

---

## 1. Context

Marriott Voya processes card-not-present (CNP) travel purchases. The platform must operate under PCI-DSS v4.0.1. The applicable self-assessment questionnaire (SAQ) determines audit scope, evidence burden, and required engineering controls.

Two tiers are under consideration:

| Tier | When it applies | Key engineering obligation |
|---|---|---|
| **SAQ-A** | All cardholder data functions fully outsourced to PCI-compliant provider; merchant website is purely static redirect or iframe | No server-side script that can intercept card data; no PANs ever reach the merchant's systems |
| **SAQ-A-EP** | Merchant's own scripts execute on a payment page even if card data goes directly to provider | Quarterly ASV scans, script-integrity controls (SRI / CSP), expanded change-management evidence |

---

## 2. Architectural Containment Argument

The payment-service and frontend are architected so that:

1. **No PAN enters the Voya system.** Card capture is performed exclusively inside Stripe-hosted Elements iframes. The Stripe JavaScript SDK communicates directly with Stripe servers; no cardholder data touches Voya's JavaScript bundle, CDN, or backend.

2. **No server-side code path exists that could accept a PAN.** The `payment-service` receives only Stripe `PaymentIntent` IDs, confirmation status events, and webhook notifications signed with the `stripe-signature` header. There is no endpoint that accepts raw card numbers.

3. **Webhook secrets are stored in environment variables / secrets manager only** and are never logged (see `@travel/observability` redaction paths: `stripe-signature`, `headers.stripe-signature`).

4. **The frontend serves no first-party scripts on payment pages that can read iframe contents.** Content-Security-Policy headers restrict script execution to the Stripe CDN origin.

These properties collectively satisfy the SAQ-A containment requirement.

---

## 3. Proposed Tier

> **SAQ-A** — subject to acquiring-bank confirmation.

### Rationale

- Architecture achieves full outsourcing of cardholder data processing to Stripe.
- No merchant-hosted JavaScript can intercept card data (iframe isolation).
- No backend code path accepts or transits PANs.
- The constraint is structurally enforced, not policy-enforced: there is no code path to violate.

---

## 4. Conditional Follow-on Scope (SAQ-A-EP)

If the acquiring bank determines SAQ-A-EP applies (e.g., due to the frontend serving any first-party scripts on the checkout domain), the following additional engineering scope becomes mandatory:

| Additional control | Engineering task | Story |
|---|---|---|
| Sub-resource Integrity (SRI) on all payment-page scripts | Add `integrity` + `crossorigin` attributes to all `<script>` tags on checkout pages | _Planned_ |
| Quarterly ASV scans | Integrate external ASV scanner into CI/CD pipeline | _Planned_ |
| Server-side script inventory | CI lint asserting no new external script origin is added to checkout pages without a security review | _Planned_ |
| Expanded change-management evidence | Require code-review approval log export to audit evidence S3 bucket for payment-related PRs | _Planned_ |
| Penetration testing (annual) | Schedule external pen-test on card flow | _Planned_ |

---

## 5. Open Questions

| ID | Question | Owner | Blocking impact | Required-by date | Interim assumption |
|---|---|---|---|---|---|
| Q1 | Does the acquiring bank accept SAQ-A given Stripe-hosted iframe architecture? | Compliance & Risk Lead | Determines entire PCI audit scope | _TBD — prior to production launch_ | ASSUMPTION: SAQ-A applies; controls implemented to SAQ-A standard |
| Q2 | Will any "illustrative results" screenshots in production be stored, and if so where? | Product Sponsor | Determines data retention scope | _TBD_ | ASSUMPTION: No production PII in demo/marketing materials |
| Q5 | What are the legally required retention periods for booking records, auth logs, and payment audit logs (jurisdiction: US + EU)? | Legal counsel | Determines retention config in observability and database TTL policies | _TBD — prior to production launch_ | ASSUMPTION: 1 year for auth audit, 7 years for financial records (US minimum), 5 years for GDPR-covered personal data |

---

## 6. Sign-off Required

| Role | Name | Date | Signature reference |
|---|---|---|---|
| Compliance and Risk Lead | _Pending_ | _Pending_ | _Pending_ |
| Product Sponsor | _Pending_ | _Pending_ | _Pending_ |
| Acquiring bank confirmation | _Pending_ | _Pending_ | _Reference #TBD_ |
