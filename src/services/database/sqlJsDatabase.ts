import type { Database as SqlJsDatabase } from 'sql.js';

import type { Database, RunResult, SqlValue } from './types';

/**
 * Web preview adapter: exposes an in-memory sql.js database through the app's
 * `Database` interface. `onWrite` lets the provider persist after changes.
 */
export function createSqlJsDatabase(db: SqlJsDatabase, onWrite: () => void): Database {
  const all = <T,>(sql: string, params: SqlValue[]): T[] => {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  };
  let inTransaction = false;

  return {
    async execAsync(sql) {
      db.exec(sql);
      if (!inTransaction) onWrite();
    },
    async runAsync(sql, params): Promise<RunResult> {
      db.run(sql, params);
      const changes = db.getRowsModified();
      const id = all<{ id: number }>('SELECT last_insert_rowid() AS id', [])[0]?.id ?? 0;
      if (!inTransaction) onWrite();
      return { lastInsertRowId: id, changes };
    },
    async getFirstAsync<T>(sql: string, params: SqlValue[]) {
      return all<T>(sql, params)[0] ?? null;
    },
    async getAllAsync<T>(sql: string, params: SqlValue[]) {
      return all<T>(sql, params);
    },
    async withTransactionAsync(task) {
      db.exec('BEGIN');
      inTransaction = true;
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      } finally {
        inTransaction = false;
      }
      onWrite();
    },
  };
}
