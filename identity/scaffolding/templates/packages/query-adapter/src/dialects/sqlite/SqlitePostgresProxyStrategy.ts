import type { CostEstimate, CostStrategy, SqlDriver } from '../../core/types.ts';
import type { CapacityProfile } from '../../core/CapacityProfile.ts';
import { estimateIndexedRows } from '../../core/CapacityProfile.ts';
import { extractTables } from '../../core/sqlTables.ts';
import { parseSqliteRisk } from './SqliteCostStrategy.ts';

export class SqlitePostgresProxyStrategy implements CostStrategy {
  constructor(
    private readonly driver: SqlDriver,
    private readonly capacityProfile: CapacityProfile,
  ) {}

  async estimate(query: string, params: unknown[]): Promise<CostEstimate> {
    const start = performance.now();
    const plan = await this.driver.explain(query, params);
    const riskSignal = parseSqliteRisk(plan);
    const tables = extractTables(query);
    const worstCase = this.capacityProfile.worstCaseRows(tables);
    const estimatedRows =
      riskSignal === 'full-scan' ? worstCase.rows : estimateIndexedRows(worstCase.rows);

    return {
      estimatedRows,
      riskSignal,
      explainDurationMs: performance.now() - start,
      raw: { plan, source: 'sqlite-postgres-proxy', missingTables: worstCase.missing },
    };
  }
}
