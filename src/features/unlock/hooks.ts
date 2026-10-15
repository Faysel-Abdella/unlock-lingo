import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useProfile, useSettings } from '@/features/settings/hooks';
import { queryKeys } from '@/hooks/queryKeys';
import { useRepositories } from '@/hooks/useRepositories';
import { unlockCards } from '@/native/unlockCards';

import { syncUnlockCards } from './unlockService';

/**
 * Keeps native card delivery in step with the app: imports card outcomes and
 * refreshes the deck on launch, on every return to the foreground and whenever
 * the unlock settings change.
 */
export function useUnlockSync() {
  const repos = useRepositories();
  const client = useQueryClient();
  const profile = useProfile().data ?? null;
  const settings = useSettings().data;

  useEffect(() => {
    if (!settings) return;
    const run = () =>
      syncUnlockCards(repos, unlockCards, profile, settings, Date.now())
        .then(() => client.invalidateQueries({ queryKey: queryKeys.learning }))
        .then(() => client.invalidateQueries({ queryKey: queryKeys.unlockStatus }))
        .catch((e: unknown) => console.warn('Unlock card sync failed', e));
    void run();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    return () => sub.remove();
  }, [repos, client, profile, settings]);
}

export function useUnlockStatus() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.unlockStatus, queryFn: () => unlockCards.getStatus(), staleTime: 0 });
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void client.invalidateQueries({ queryKey: queryKeys.unlockStatus });
    });
    return () => sub.remove();
  }, [client]);
  return query;
}
