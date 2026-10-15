import type { Migration } from './index';

/**
 * Speaking practice attempts. Kept apart from `review_history` because speaking
 * is optional practice judged by a speech recogniser: it never changes FSRS state.
 */
export const migration002: Migration = {
  version: 2,
  name: 'pronunciation attempts',
  sql: `
CREATE TABLE pronunciation_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL REFERENCES learning_items (id) ON DELETE CASCADE,
  expected TEXT NOT NULL,
  heard TEXT,
  similarity REAL NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('clear', 'close', 'unclear')),
  attempted_at INTEGER NOT NULL
);
CREATE INDEX idx_pronunciation_item ON pronunciation_attempts (item_id, attempted_at);
CREATE INDEX idx_pronunciation_attempted_at ON pronunciation_attempts (attempted_at);
`,
};
