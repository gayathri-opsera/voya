/**
 * Presentational-only types for the frontend.
 * Platform payload types must be imported from @travel/contracts.
 * No platform request/response interfaces are declared here.
 */

export interface SearchFormValues {
  tripType: "one-way" | "round-trip";
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  duration?: number;
}

export interface OfferFilterState {
  sortBy: "price-asc" | "price-desc" | "freshness" | "rating";
  showBookableOnly: boolean;
}
