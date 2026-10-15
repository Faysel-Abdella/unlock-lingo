export type SqlValue = string | number | null;

export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

/**
 * The subset of the expo-sqlite `SQLiteDatabase` API that repositories use.
 * Keeping it small lets tests run the same repositories against Node's built-in
 * `node:sqlite` (see `testing/nodeDatabase.ts`).
 */
export interface Database {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlValue[]): Promise<RunResult>;
  getFirstAsync<T>(sql: string, params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
