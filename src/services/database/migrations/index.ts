import type { Database } from '../types';
import { migration001 } from './001_initial';
import { migration002 } from './002_pronunciation';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/** Ordered list of schema migrations. Never edit a shipped migration: add a new one. */
export const MIGRATIONS: readonly Migration[] = [migration001, migration002];

export async function getSchemaVersion(db: Database): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  return row?.user_version ?? 0;
}

/**
 * Applies pending migrations in order, each in its own transaction, tracking
 * progress with `PRAGMA user_version`. Returns the versions that were applied.
 */
export async function runMigrations(db: Database, migrations: readonly Migration[] = MIGRATIONS): Promise<number[]> {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  const current = await getSchemaVersion(db);
  const applied: number[] = [];
  for (const migration of sorted) {
    if (migration.version <= current) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      // PRAGMA does not accept bound parameters; the version is a trusted integer.
      await db.execAsync(`PRAGMA user_version = ${Math.trunc(migration.version)}`);
    });
    applied.push(migration.version);
  }
  return applied;
}
