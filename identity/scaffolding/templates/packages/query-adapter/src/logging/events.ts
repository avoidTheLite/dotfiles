import type { AppEnv, QueryDialect, RiskSignal } from '../core/types.ts';

export type QueryGuardEventName =
  | 'query_cost_estimate'
  | 'query_guard_tripped'
  | 'query_guard_bypassed'
  | 'approaching_design_capacity'
  | 'table_missing_from_capacity_profile';

export interface QueryGuardLogBase {
  event: QueryGuardEventName;
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
  capacityProfileVersion?: string;
  queryText?: string;
}

export interface QueryCostEstimateEvent extends QueryGuardLogBase {
  event: 'query_cost_estimate';
  threshold: number;
  enforceMode: boolean;
}

export interface QueryGuardTrippedEvent extends QueryGuardLogBase {
  event: 'query_guard_tripped';
  threshold: number;
  thresholdSource: 'default' | 'environment-override' | 'per-query-override';
}

export interface QueryGuardBypassedEvent extends QueryGuardLogBase {
  event: 'query_guard_bypassed';
  threshold: number;
  bypassReason: string;
}

export interface ApproachingDesignCapacityEvent extends QueryGuardLogBase {
  event: 'approaching_design_capacity';
  designMaxRows: number;
  percentOfCapacity: number;
}

export interface TableMissingFromCapacityProfileEvent extends QueryGuardLogBase {
  event: 'table_missing_from_capacity_profile';
  missingTables: string[];
}

export type QueryGuardLogEvent =
  | QueryCostEstimateEvent
  | QueryGuardTrippedEvent
  | QueryGuardBypassedEvent
  | ApproachingDesignCapacityEvent
  | TableMissingFromCapacityProfileEvent;
