import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const UNKNOWN_TABLE_CEILING = 10_000_000;
export const CAPACITY_DRIFT_RATIO = 0.8;

export interface TableCapacityEntry {
  table: string;
  designMaxRows: number;
  sla?: { p95QueryMs: number };
  owner: string;
  lastReviewed: string;
}

export class CapacityProfile {
  constructor(
    private readonly entries: TableCapacityEntry[],
    readonly version: string,
  ) {}

  get(table: string): TableCapacityEntry | undefined {
    return this.entries.find((entry) => entry.table === table);
  }

  worstCaseRows(tables: string[]): { rows: number; missing: string[] } {
    if (tables.length === 0) {
      return { rows: UNKNOWN_TABLE_CEILING, missing: [] };
    }
    const missing: string[] = [];
    let max = 0;
    for (const table of tables) {
      const entry = this.get(table);
      if (!entry) {
        missing.push(table);
        max = Math.max(max, UNKNOWN_TABLE_CEILING);
      } else {
        max = Math.max(max, entry.designMaxRows);
      }
    }
    return { rows: max, missing };
  }
}

export function loadCapacityProfile(profilePath: string | URL): CapacityProfile {
  const path = typeof profilePath === 'string' ? profilePath : profilePath.pathname;
  const source = readFileSync(path, 'utf8');
  const parsed: unknown = JSON.parse(source);
  if (!Array.isArray(parsed)) {
    throw new Error('table-capacity-profile.json must be an array');
  }
  const entries = parsed.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('capacity profile entries must be objects');
    }
    const row = item as Partial<TableCapacityEntry>;
    if (typeof row.table !== 'string' || typeof row.designMaxRows !== 'number') {
      throw new Error('capacity profile entries require table and designMaxRows');
    }
    return item as TableCapacityEntry;
  });
  const version = createHash('sha256').update(source).digest('hex').slice(0, 12);
  return new CapacityProfile(entries, version);
}

export function estimateIndexedRows(worstCase: number): number {
  return Math.max(1, Math.ceil(worstCase / 1000));
}
