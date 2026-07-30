/**
 * Egress allow-list — SSRF protection at the adapter layer (TB4 trust boundary).
 *
 * Every outbound supplier HTTP call must resolve to a hostname on the
 * allow-list. IP literals and redirects to off-list hosts are blocked.
 *
 * Config: SUPPLIER_ALLOWED_HOSTS comma-separated list of exact hostnames.
 * Example: "api.amadeus.com,hotels.rapidapi.com,cars.rapidapi.com"
 */

import { SupplierEgressBlockedError } from "./errors.js";

export interface EgressAllowListConfig {
  allowedHosts: ReadonlySet<string>;
  supplierName: string;
}

export class EgressAllowList {
  private readonly allowed: ReadonlySet<string>;
  private readonly supplierName: string;

  constructor(config: EgressAllowListConfig) {
    if (config.allowedHosts.size === 0) {
      throw new Error(
        "EgressAllowList: allowedHosts must not be empty — refusing to start with no egress restriction",
      );
    }
    this.allowed = config.allowedHosts;
    this.supplierName = config.supplierName;
  }

  /** Throws SupplierEgressBlockedError if the URL host is not allow-listed. */
  check(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new SupplierEgressBlockedError(this.supplierName, url);
    }

    const host = parsed.hostname.toLowerCase();

    // Reject raw IP literals (IPv4 and IPv6)
    if (isIpLiteral(host)) {
      throw new SupplierEgressBlockedError(this.supplierName, host);
    }

    if (!this.allowed.has(host)) {
      throw new SupplierEgressBlockedError(this.supplierName, host);
    }
  }

  /** Build an allow-list from a comma-separated env string. */
  static fromEnv(
    supplierName: string,
    envValue: string | undefined,
  ): EgressAllowList {
    const raw = envValue ?? "";
    const hosts = raw
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    return new EgressAllowList({
      supplierName,
      allowedHosts: new Set(hosts),
    });
  }
}

function isIpLiteral(hostname: string): boolean {
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  // IPv6 (brackets stripped by URL parser)
  if (/^[0-9a-f:]+$/i.test(hostname) && hostname.includes(":")) return true;
  return false;
}
