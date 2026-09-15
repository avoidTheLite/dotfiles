import type { AppEnv } from './types.ts';

export interface GuardConfig {
  enforce: boolean;
  threshold: number;
  statementTimeoutMs: number;
  logRawQuery: boolean;
}

export const DEFAULT_ROW_THRESHOLD = 1_000_000;
export const DEFAULT_STATEMENT_TIMEOUT_MS = 5_000;

export function resolveGuardConfig(opts: {
  appEnv: AppEnv;
  serviceOverrides?: Partial<GuardConfig>;
}): GuardConfig {
  const enforceOverride = opts.serviceOverrides?.enforce;
  return {
    enforce: enforceOverride ?? opts.appEnv === 'performance-testing',
    threshold: opts.serviceOverrides?.threshold ?? DEFAULT_ROW_THRESHOLD,
    statementTimeoutMs: opts.serviceOverrides?.statementTimeoutMs ?? DEFAULT_STATEMENT_TIMEOUT_MS,
    logRawQuery: opts.serviceOverrides?.logRawQuery ?? false,
  };
}
