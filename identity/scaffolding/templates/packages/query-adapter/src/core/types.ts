export type DriverKind = 'knex';

export type ProductionDialect = 'postgres' | 'sqlite' | 'duckdb';

export type TestStrategy = 'sqlite-pg-proxy' | 'sqlite' | 'postgres';

export type RuntimeEngine = 'postgres' | 'sqlite';

export type CostStrategyName = 'postgres' | 'sqlite' | 'sqlite-pg-proxy' | 'duckdb';

export type QueryDialect = CostStrategyName;

export type AppEnv = 'development' | 'staging' | 'production' | 'performance-testing';

export type NodeEnv = 'development' | 'test' | 'production';

export type RiskSignal = 'full-scan' | 'indexed' | 'unknown';

export interface CostEstimate {
  estimatedRows: number | null;
  riskSignal: RiskSignal;
  explainDurationMs: number;
  raw: unknown;
}

export interface CostStrategy {
  estimate(query: string, params: unknown[]): Promise<CostEstimate>;
}

export interface BypassReason {
  reason: string;
}

export interface QueryOptions {
  guardBypass?: BypassReason;
  guardThresholdOverride?: number;
  correlationId?: string;
}

export interface GuardResult {
  allowed: boolean;
  estimate: CostEstimate;
}

export interface SqlDriver {
  readonly kind: DriverKind;
  execute<T>(sql: string, params?: unknown[]): Promise<T[]>;
  explain(sql: string, params?: unknown[]): Promise<unknown>;
  destroy(): Promise<void>;
}

export interface RuntimeSelection {
  engine: RuntimeEngine;
  costStrategy: CostStrategyName;
}

export function resolveRuntime(opts: {
  productionDialect: ProductionDialect;
  nodeEnv: NodeEnv;
  testStrategy: TestStrategy;
}): RuntimeSelection {
  if (opts.productionDialect === 'duckdb') {
    return { engine: 'sqlite', costStrategy: 'duckdb' };
  }

  if (opts.nodeEnv === 'production') {
    if (opts.productionDialect === 'postgres') {
      return { engine: 'postgres', costStrategy: 'postgres' };
    }
    return { engine: 'sqlite', costStrategy: 'sqlite' };
  }

  if (opts.productionDialect === 'postgres') {
    if (opts.testStrategy === 'postgres') {
      return { engine: 'postgres', costStrategy: 'postgres' };
    }
    if (opts.testStrategy === 'sqlite') {
      return { engine: 'sqlite', costStrategy: 'sqlite' };
    }
    return { engine: 'sqlite', costStrategy: 'sqlite-pg-proxy' };
  }

  return { engine: 'sqlite', costStrategy: 'sqlite' };
}
