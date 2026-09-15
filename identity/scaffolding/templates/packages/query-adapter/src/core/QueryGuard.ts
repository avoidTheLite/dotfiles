import type { AppEnv, CostEstimate, CostStrategy, QueryDialect, QueryOptions, RiskSignal } from './types.ts';
import type { CapacityProfile } from './CapacityProfile.ts';
import { CAPACITY_DRIFT_RATIO } from './CapacityProfile.ts';
import type { GuardConfig } from './GuardConfig.ts';
import { QueryTooExpensiveError } from './errors.ts';
import type { GuardResult } from './types.ts';
import type { QueryGuardLogEvent } from '../logging/events.ts';
import { extractTables, queryId } from './sqlTables.ts';

export type QueryGuardEmit = (event: QueryGuardLogEvent, extras?: { raw?: unknown }) => void;

interface GuardContext {
  dialect: QueryDialect;
  service: string;
  appEnv: AppEnv;
}

export class QueryGuard {
  constructor(
    private readonly strategy: CostStrategy,
    private readonly config: GuardConfig,
    private readonly capacityProfile: CapacityProfile,
    private readonly emit: QueryGuardEmit,
    private readonly context: GuardContext,
  ) {}

  async check(query: string, params: unknown[], opts?: QueryOptions): Promise<GuardResult> {
    const estimate = await this.strategy.estimate(query, params);
    const threshold = opts?.guardThresholdOverride ?? this.config.threshold;
    const thresholdSource = opts?.guardThresholdOverride != null ? 'per-query-override' : 'default';
    const tables = extractTables(query);
    const base = this.baseFields(query, tables, estimate, opts);
    const missing = tables.filter((table) => this.capacityProfile.get(table) === undefined);
    if (missing.length > 0) {
      this.emit({
        ...base,
        event: 'table_missing_from_capacity_profile',
        missingTables: missing,
      });
    }

    this.emit(
      {
        ...base,
        event: 'query_cost_estimate',
        threshold,
        enforceMode: this.config.enforce,
      },
      { raw: estimate.raw },
    );

    this.checkCapacityDrift(tables, estimate, base);

    if (opts?.guardBypass) {
      this.emit({
        ...base,
        event: 'query_guard_bypassed',
        threshold,
        bypassReason: opts.guardBypass.reason,
      });
      return { allowed: true, estimate };
    }

    if (!this.config.enforce) {
      return { allowed: true, estimate };
    }

    const tripped = estimate.estimatedRows != null && estimate.estimatedRows > threshold;
    if (tripped) {
      this.emit({
        ...base,
        event: 'query_guard_tripped',
        threshold,
        thresholdSource,
      });
      throw new QueryTooExpensiveError(estimate, threshold);
    }

    return { allowed: true, estimate };
  }

  private checkCapacityDrift(
    tables: string[],
    estimate: CostEstimate,
    base: ReturnType<QueryGuard['baseFields']>,
  ): void {
    if (this.context.dialect !== 'postgres' || estimate.estimatedRows == null) {
      return;
    }
    for (const table of tables) {
      const entry = this.capacityProfile.get(table);
      if (!entry || entry.designMaxRows <= 0) {
        continue;
      }
      const percentOfCapacity = estimate.estimatedRows / entry.designMaxRows;
      if (percentOfCapacity >= CAPACITY_DRIFT_RATIO) {
        this.emit({
          ...base,
          event: 'approaching_design_capacity',
          designMaxRows: entry.designMaxRows,
          percentOfCapacity,
        });
      }
    }
  }

  private baseFields(
    query: string,
    tables: string[],
    estimate: CostEstimate,
    opts?: QueryOptions,
  ): {
    timestamp: string;
    service: string;
    environment: AppEnv;
    dialect: QueryDialect;
    correlationId?: string;
    queryId: string;
    tables: string[];
    estimatedRows: number | null;
    riskSignal: RiskSignal;
    explainDurationMs: number;
    capacityProfileVersion: string;
    queryText?: string;
  } {
    return {
      timestamp: new Date().toISOString(),
      service: this.context.service,
      environment: this.context.appEnv,
      dialect: this.context.dialect,
      correlationId: opts?.correlationId,
      queryId: queryId(query),
      tables,
      estimatedRows: estimate.estimatedRows,
      riskSignal: estimate.riskSignal,
      explainDurationMs: estimate.explainDurationMs,
      capacityProfileVersion: this.capacityProfile.version,
      queryText: this.config.logRawQuery ? query.slice(0, 500) : undefined,
    };
  }
}
