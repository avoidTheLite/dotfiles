import type { CostEstimate, CostStrategy, RiskSignal, SqlDriver } from '../../core/types.ts';

export class PostgresCostStrategy implements CostStrategy {
  constructor(private readonly driver: SqlDriver) {}

  async estimate(query: string, params: unknown[]): Promise<CostEstimate> {
    const start = performance.now();
    const raw = await this.driver.explain(query, params);
    const parsed = parsePostgresExplain(raw);
    return {
      estimatedRows: parsed.estimatedRows,
      riskSignal: parsed.riskSignal,
      explainDurationMs: performance.now() - start,
      raw,
    };
  }
}

export function parsePostgresExplain(raw: unknown): {
  estimatedRows: number | null;
  riskSignal: RiskSignal;
} {
  const plan = findPlanNode(raw);
  if (!plan) {
    return { estimatedRows: null, riskSignal: 'unknown' };
  }
  const estimatedRows = typeof plan['Plan Rows'] === 'number' ? plan['Plan Rows'] : null;
  const nodeType = typeof plan['Node Type'] === 'string' ? plan['Node Type'] : '';
  return { estimatedRows, riskSignal: riskFromNodeType(nodeType) };
}

function riskFromNodeType(nodeType: string): RiskSignal {
  const normalized = nodeType.toLowerCase();
  if (normalized.includes('seq scan')) {
    return 'full-scan';
  }
  if (normalized.includes('index')) {
    return 'indexed';
  }
  return 'unknown';
}

function findPlanNode(raw: unknown): Record<string, unknown> | null {
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const found = findPlanNode(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (record.Plan && typeof record.Plan === 'object') {
    return record.Plan as Record<string, unknown>;
  }
  if (record['QUERY PLAN']) {
    return findPlanNode(record['QUERY PLAN']);
  }
  if (typeof record['Node Type'] === 'string') {
    return record;
  }
  return null;
}
