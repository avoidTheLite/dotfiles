import { createHash } from 'node:crypto';

const TABLE_RE = /\b(?:from|join)\s+"?([a-zA-Z_][\w]*)"?/gi;

export function extractTables(sql: string): string[] {
  const tables = new Set<string>();
  for (const match of sql.matchAll(TABLE_RE)) {
    const table = match[1];
    if (table) {
      tables.add(table.toLowerCase());
    }
  }
  return [...tables];
}

export function queryId(sql: string): string {
  const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}
