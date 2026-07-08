/** A provider feature that Relay can depend on. */
export const PROVIDER_CAPABILITY = {
  snapshots: "snapshots",
  historicalBars: "historical_bars",
  marketClock: "market_clock",
  liveTrades: "live_trades",
  liveBars: "live_bars",
  liveQuotes: "live_quotes",
} as const;

/** A provider feature supported by a market data adapter. */
export type ProviderCapability = (typeof PROVIDER_CAPABILITY)[keyof typeof PROVIDER_CAPABILITY];

/** Describes what a market data provider adapter can do. */
export interface ProviderCapabilities {
  readonly snapshots?: boolean;
  readonly historicalBars?: boolean;
  readonly marketClock?: boolean;
  readonly liveTrades?: boolean;
  readonly liveBars?: boolean;
  readonly liveQuotes?: boolean;
}

/** Returns true when the provider supports the requested capability. */
export function hasProviderCapability(
  capabilities: ProviderCapabilities,
  capability: ProviderCapability,
): boolean {
  switch (capability) {
    case PROVIDER_CAPABILITY.snapshots:
      return capabilities.snapshots === true;
    case PROVIDER_CAPABILITY.historicalBars:
      return capabilities.historicalBars === true;
    case PROVIDER_CAPABILITY.marketClock:
      return capabilities.marketClock === true;
    case PROVIDER_CAPABILITY.liveTrades:
      return capabilities.liveTrades === true;
    case PROVIDER_CAPABILITY.liveBars:
      return capabilities.liveBars === true;
    case PROVIDER_CAPABILITY.liveQuotes:
      return capabilities.liveQuotes === true;
  }
}

/** Throws when a provider does not support a required capability. */
export function assertProviderCapability(
  providerName: string,
  capabilities: ProviderCapabilities,
  capability: ProviderCapability,
): void {
  if (!hasProviderCapability(capabilities, capability)) {
    throw new Error(`${providerName} does not support ${capability}.`);
  }
}
