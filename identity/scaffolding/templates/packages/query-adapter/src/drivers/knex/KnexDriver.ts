import type { Knex } from 'knex';
import type { DriverKind, RuntimeEngine, SqlDriver } from '../../core/types.ts';

export class KnexDriver implements SqlDriver {
  readonly kind: DriverKind = 'knex';

  constructor(
    private readonly db: Knex,
    private readonly engine: RuntimeEngine,
  ) {}

  async execute<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result: unknown = await this.db.raw(sql, params as Knex.RawBinding[]);
    return unwrapRows<T>(result);
  }

  async explain(sql: string, params: unknown[] = []): Promise<unknown> {
    const prefix = this.engine === 'postgres' ? 'EXPLAIN (FORMAT JSON) ' : 'EXPLAIN QUERY PLAN ';
    const result: unknown = await this.db.raw(`${prefix}${sql}`, params as Knex.RawBinding[]);
    return unwrapRows(result);
  }

  async destroy(): Promise<void> {
    await this.db.destroy();
  }
}

function unwrapRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    const first = result[0];
    if (Array.isArray(first)) {
      return first as T[];
    }
    return result as T[];
  }
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows: T[] }).rows;
    return Array.isArray(rows) ? rows : [];
  }
  return [];
}
