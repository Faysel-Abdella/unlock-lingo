import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { type ReactNode, Suspense } from 'react';

import { DatabaseContext } from './DatabaseContext';
import { DATABASE_NAME, initializeDatabase } from './initialize';

/** Native: expo-sqlite. Migrations and seeding run before children render. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase} useSuspense>
        <Bridge>{children}</Bridge>
      </SQLiteProvider>
    </Suspense>
  );
}

function Bridge({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}
