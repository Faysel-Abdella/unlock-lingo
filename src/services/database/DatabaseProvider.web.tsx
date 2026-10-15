import { type ReactNode, useEffect, useState } from 'react';
import initSqlJs from 'sql.js/dist/sql-wasm-inline.js';

import { DatabaseContext } from './DatabaseContext';
import { initializeDatabase } from './initialize';
import { createSqlJsDatabase } from './sqlJsDatabase';
import type { Database } from './types';

const STORAGE_KEY = 'unlock-lingo.preview-db';

function load(): Uint8Array | undefined {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!saved) return undefined;
    return Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
  } catch {
    return undefined; // storage unavailable (private mode, sandboxed preview)
  }
}

function save(bytes: Uint8Array) {
  try {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    globalThis.localStorage?.setItem(STORAGE_KEY, btoa(binary));
  } catch {
    // Best effort: the preview still works, it just starts fresh next time.
  }
}

/**
 * Web preview only: SQLite compiled to WebAssembly (sql.js), held in memory and
 * saved to localStorage. Unlike expo-sqlite on web it needs no cross-origin
 * isolation headers, so the preview runs on any static host.
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const SQL = await initSqlJs();
      const raw = new SQL.Database(load());
      const persist = () => {
        clearTimeout(timer);
        timer = setTimeout(() => save(raw.export()), 500);
      };
      const database = createSqlJsDatabase(raw, persist);
      await initializeDatabase(database);
      setDb(database);
    })().catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
    return () => clearTimeout(timer);
  }, []);

  if (error) throw error;
  if (!db) return null;
  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}
