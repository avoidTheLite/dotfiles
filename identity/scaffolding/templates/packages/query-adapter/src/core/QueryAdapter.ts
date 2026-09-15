import type { CostEstimate, QueryOptions, SqlDriver } from './types.ts';
import type { QueryGuard } from './QueryGuard.ts';

export interface QueryAdapter {
  query<T>(sql: string, params?: unknown[], opts?: QueryOptions): Promise<T[]>;
}

export class SqlQueryAdapter implements QueryAdapter {
  constructor(
    private readonly driver: SqlDriver,
    private readonly guard: QueryGuard,
  ) {}

  async query<T>(sql: string, params: unknown[] = [], opts?: QueryOptions): Promise<T[]> {
    await this.guard.check(sql, params, opts);
    return this.driver.execute<T>(sql, params);
  }
}

export function stripRawEstimate(estimate: CostEstimate): Omit<CostEstimate, 'raw'> {
  const { raw: _raw, ...safe } = estimate;
  return safe;
}
