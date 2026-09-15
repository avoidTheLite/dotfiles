import type { CostEstimate, CostStrategy, RiskSignal, SqlDriver } from '../../core/types.ts';

export class SqliteCostStrategy implements CostStrategy {
  constructor(private readonly driver: SqlDriver) {}

  async estimate(query: string, params: unknown[]): Promise<CostEstimate> {
    const start = performance.now();
    const raw = await this.driver.explain(query, params);
    return {
      estimatedRows: null,
      riskSignal: parseSqliteRisk(raw),
      explainDurationMs: performance.now() - start,
      raw,
    };
  }
}

export function parseSqliteRisk(raw: unknown): RiskSignal {
  const details = sqliteDetails(raw);
  if (details.some((detail) => /\bSCAN\b/i.test(detail) && !/\bINDEX\b/i.test(detail))) {
    return 'full-scan';
  }
  if (details.some((detail) => /\bSEARCH\b/i.test(detail) || /\bINDEX\b/i.test(detail))) {
    return 'indexed';
  }
  return 'unknown';
}

export function sqliteDetails(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((row) => {
      if (row && typeof row === 'object' && 'detail' in row && typeof row.detail === 'string') {
        return row.detail;
      }
      return '';
    })
    .filter((detail) => detail.length > 0);
}
