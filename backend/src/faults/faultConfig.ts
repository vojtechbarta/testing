export type FaultKey = "productListing_latency" | "cart_price_miscalculation";

export interface FaultSettings {
  enabled: boolean;
  latencyMs?: number;
  failureRate?: number;
}

export const faultConfig: Record<FaultKey, FaultSettings> = {
  productListing_latency: { enabled: false, latencyMs: 1500 },
  cart_price_miscalculation: { enabled: false, failureRate: 1 },
};

