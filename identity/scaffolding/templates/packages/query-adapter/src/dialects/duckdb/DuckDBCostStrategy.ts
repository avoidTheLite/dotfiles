import type { CostEstimate, CostStrategy } from '../../core/types.ts';

/**
 * Stub only. DuckDB EXPLAIN JSON is not designed yet; do not reuse the Postgres parser.
 */
export class DuckDBCostStrategy implements CostStrategy {
  async estimate(_query: string, _params: unknown[]): Promise<CostEstimate> {
    return {
      estimatedRows: null,
      riskSignal: 'unknown',
      explainDurationMs: 0,
      raw: { pending: 'duckdb-design-review' },
    };
  }
}
