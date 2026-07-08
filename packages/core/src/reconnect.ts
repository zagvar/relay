const DEFAULT_INITIAL_DELAY_MS = 1_000;
const DEFAULT_MAX_DELAY_MS = 30_000;
const DEFAULT_MULTIPLIER = 2;

/** Options for exponential reconnect delay calculation. */
export interface ReconnectBackoffOptions {
  readonly initialDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly multiplier?: number;
}

/** Calculates a capped exponential reconnect delay for a retry attempt. */
export function calculateReconnectDelay(
  attempt: number,
  options: ReconnectBackoffOptions = {},
): number {
  if (attempt < 0) {
    throw new Error("attempt must be greater than or equal to zero.");
  }

  const initialDelayMs = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const multiplier = options.multiplier ?? DEFAULT_MULTIPLIER;

  if (initialDelayMs <= 0) {
    throw new Error("initialDelayMs must be greater than zero.");
  }

  if (maxDelayMs < initialDelayMs) {
    throw new Error("maxDelayMs must be greater than or equal to initialDelayMs.");
  }

  if (multiplier < 1) {
    throw new Error("multiplier must be greater than or equal to one.");
  }

  const delay = initialDelayMs * multiplier ** attempt;

  return Math.min(delay, maxDelayMs);
}
