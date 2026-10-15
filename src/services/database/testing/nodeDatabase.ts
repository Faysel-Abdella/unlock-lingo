/**
 * Test-only adapter exposing Node's built-in `node:sqlite` through the app's
 * `Database` interface, so migrations and repositories run against real SQLite.
 * Never import this from app code.
 */
import { DatabaseSync } from 'node:sqlite';

import type { Database, RunResult, SqlValue } from '../types';

export function createNodeDatabase(): Database & { close(): void } {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');

  return {
    async execAsync(sql: string) {
      db.exec(sql);
    },
    async runAsync(sql: string, params: SqlValue[]): Promise<RunResult> {
      const result = db.prepare(sql).run(...params);
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async getFirstAsync<T>(sql: string, params: SqlValue[]): Promise<T | null> {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]> {
      return db.prepare(sql).all(...params) as T[];
    },
    async withTransactionAsync(task: () => Promise<void>) {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      db.close();
    },
  };
}
