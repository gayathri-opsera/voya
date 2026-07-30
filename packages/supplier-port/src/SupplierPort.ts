/**
 * SupplierPort — the single abstraction governing all outbound supplier calls.
 *
 * Flow shapes:
 *   INSTANT              — searchOffers returns live-priced, immediately bookable offers
 *   RESERVE_THEN_CONFIRM — two-phase: reserve secures inventory, confirm commits
 *   ARI_PUSH             — supplier pushes Availability-Rate-Inventory; no search leg
 */

export type SupplierFlowShape =
  | "INSTANT"
  | "RESERVE_THEN_CONFIRM"
  | "ARI_PUSH";

/** Minimal search criteria shape (adapters receive the full SearchCriteria from @travel/contracts). */
export interface SearchCriteria {
  [key: string]: unknown;
}

/** Normalised offer coming out of any adapter — shape must align with @travel/contracts. */
export interface NormalisedOffer {
  offerId: string;
  provider: string;
  provenance: string;
  bookable: boolean;
  [key: string]: unknown;
}

export interface ReserveInput {
  offerId: string;
  travelers: unknown[];
  correlationId?: string;
}

export interface ReserveResult {
  reservationId: string;
  expiresAt: Date;
  price: { amount: number; currency: string };
}

export interface ConfirmInput {
  reservationId: string;
  correlationId?: string;
}

export interface ConfirmResult {
  confirmationCode: string;
  confirmedAt: Date;
}

/**
 * SupplierPort — implement this interface for each supplier adapter.
 */
export interface SupplierPort {
  /** Unique name used in logging and metrics. */
  readonly name: string;
  /** Determines whether reserve/confirm methods are applicable. */
  readonly flowShape: SupplierFlowShape;

  /** Search for available offers. */
  searchOffers(criteria: SearchCriteria): Promise<NormalisedOffer[]>;

  /** (RESERVE_THEN_CONFIRM only) Secure inventory. */
  reserve?(input: ReserveInput): Promise<ReserveResult>;

  /** (RESERVE_THEN_CONFIRM only) Finalise reservation. */
  confirm?(input: ConfirmInput): Promise<ConfirmResult>;
}
