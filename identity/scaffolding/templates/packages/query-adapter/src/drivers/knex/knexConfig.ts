import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Knex } from 'knex';
import type { NodeEnv, ProductionDialect, TestStrategy } from '../../core/types.ts';
import { resolveRuntime } from '../../core/types.ts';
import { DEFAULT_STATEMENT_TIMEOUT_MS } from '../../core/GuardConfig.ts';

export function sqliteFilename(connection: string | undefined, fallback: string): string {
  if (!connection || connection.length === 0) {
    return fallback;
  }
  if (connection === ':memory:') {
    return ':memory:';
  }
  if (connection.startsWith('file:')) {
    return connection.replace(/^file:(?:\/\/)?/, '');
  }
  return connection;
}

function ensureSqliteFile(filename: string): string {
  if (filename === ':memory:') {
    return filename;
  }
  mkdirSync(dirname(filename), { recursive: true });
  return filename;
}

export function resolveKnexConfig(opts: {
  productionDialect: ProductionDialect;
  nodeEnv: NodeEnv;
  testStrategy: TestStrategy;
  connection?: string;
  statementTimeoutMs?: number;
}): Knex.Config {
  const runtime = resolveRuntime(opts);
  const timeout = opts.statementTimeoutMs ?? DEFAULT_STATEMENT_TIMEOUT_MS;
  if (runtime.engine === 'postgres') {
    return postgresKnexConfig(opts.connection, timeout);
  }
  return sqliteKnexConfig(opts.connection, opts.nodeEnv);
}

export function postgresKnexConfig(connection: string | undefined, statementTimeoutMs: number): Knex.Config {
  return {
    client: 'pg',
    connection: connection ?? process.env.DATABASE_URL,
    pool: {
      afterCreate(conn: { query: (sql: string, cb: (err: Error | null) => void) => void }, done: (err: Error | null, conn: unknown) => void) {
        conn.query(`SET statement_timeout TO ${statementTimeoutMs}`, (err) => {
          done(err, conn);
        });
      },
    },
  };
}

export function sqliteKnexConfig(connection: string | undefined, nodeEnv: NodeEnv): Knex.Config {
  const fallback = nodeEnv === 'test' ? ':memory:' : `./tmp/${nodeEnv}.sqlite3`;
  return {
    client: 'better-sqlite3',
    connection: {
      filename: ensureSqliteFile(sqliteFilename(connection, fallback)),
    },
    useNullAsDefault: true,
  };
}
