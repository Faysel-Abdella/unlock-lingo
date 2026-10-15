import { useSQLiteContext } from 'expo-sqlite';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

import { type Repositories, createRepositories } from '@/repositories';

const RepositoriesContext = createContext<Repositories | null>(null);

/** Must be rendered inside `SQLiteProvider`. */
export function RepositoriesProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const repos = useMemo(() => createRepositories(db), [db]);
  return <RepositoriesContext.Provider value={repos}>{children}</RepositoriesContext.Provider>;
}

export function useRepositories(): Repositories {
  const repos = useContext(RepositoriesContext);
  if (!repos) throw new Error('useRepositories must be used inside RepositoriesProvider');
  return repos;
}
