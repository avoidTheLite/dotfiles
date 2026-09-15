import { describe, expect, it } from 'vitest';
import { resolveRuntime } from './types.ts';
import { resolveGuardConfig } from './GuardConfig.ts';

describe('resolveRuntime', () => {
  it('uses sqlite-pg-proxy for postgres services in test by default', () => {
    expect(
      resolveRuntime({
        productionDialect: 'postgres',
        nodeEnv: 'test',
        testStrategy: 'sqlite-pg-proxy',
      }),
    ).toEqual({ engine: 'sqlite', costStrategy: 'sqlite-pg-proxy' });
  });

  it('uses postgres in production even when testStrategy is the proxy', () => {
    expect(
      resolveRuntime({
        productionDialect: 'postgres',
        nodeEnv: 'production',
        testStrategy: 'sqlite-pg-proxy',
      }),
    ).toEqual({ engine: 'postgres', costStrategy: 'postgres' });
  });

  it('honors a postgres test override', () => {
    expect(
      resolveRuntime({
        productionDialect: 'postgres',
        nodeEnv: 'test',
        testStrategy: 'postgres',
      }),
    ).toEqual({ engine: 'postgres', costStrategy: 'postgres' });
  });

  it('uses standalone sqlite when sqlite is the real database', () => {
    expect(
      resolveRuntime({
        productionDialect: 'sqlite',
        nodeEnv: 'test',
        testStrategy: 'sqlite',
      }),
    ).toEqual({ engine: 'sqlite', costStrategy: 'sqlite' });
  });
});

describe('resolveGuardConfig', () => {
  it('defaults enforce off except performance-testing', () => {
    expect(resolveGuardConfig({ appEnv: 'production' }).enforce).toBe(false);
    expect(resolveGuardConfig({ appEnv: 'development' }).enforce).toBe(false);
    expect(resolveGuardConfig({ appEnv: 'performance-testing' }).enforce).toBe(true);
  });
});
