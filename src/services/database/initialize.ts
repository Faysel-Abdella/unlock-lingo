import { runMigrations } from './migrations';
import { seedContent } from './seed';
import type { Database } from './types';

export const DATABASE_NAME = 'unlock-lingo.db';

/** Runs on every launch before any screen renders: pragmas, migrations, bundled content. */
export async function initializeDatabase(db: Database): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  await seedContent(db, Date.now());
}
