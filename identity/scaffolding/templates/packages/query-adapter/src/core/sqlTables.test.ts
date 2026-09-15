import { describe, expect, it } from 'vitest';
import { extractTables, queryId } from './sqlTables.ts';
import { parsePostgresExplain } from '../dialects/postgres/PostgresCostStrategy.ts';
import { parseSqliteRisk } from '../dialects/sqlite/SqliteCostStrategy.ts';
import { DuckDBCostStrategy } from '../dialects/duckdb/DuckDBCostStrategy.ts';

describe('extractTables', () => {
  it('finds from and join tables', () => {
    expect(extractTables('select * from orders join order_items on orders.id = order_items.order_id')).toEqual(
      ['orders', 'order_items'],
    );
  });
});

describe('queryId', () => {
  it('is stable across whitespace', () => {
    expect(queryId('SELECT 1')).toEqual(queryId('select   1'));
  });
});

describe('explain parsers', () => {
  it('reads postgres plan rows and seq scan', () => {
    expect(
      parsePostgresExplain([{ Plan: { 'Node Type': 'Seq Scan', 'Plan Rows': 42 } }]),
    ).toEqual({ estimatedRows: 42, riskSignal: 'full-scan' });
  });

  it('reads sqlite scan vs index', () => {
    expect(parseSqliteRisk([{ detail: 'SCAN TABLE users' }])).toBe('full-scan');
    expect(parseSqliteRisk([{ detail: 'SEARCH TABLE users USING INDEX users_email' }])).toBe('indexed');
  });
});

describe('DuckDBCostStrategy', () => {
  it('stubs unknown estimates pending design', async () => {
    const strategy = new DuckDBCostStrategy();
    const estimate = await strategy.estimate('select 1', []);
    expect(estimate.estimatedRows).toBeNull();
    expect(estimate.riskSignal).toBe('unknown');
  });
});
