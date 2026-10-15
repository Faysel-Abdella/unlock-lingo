import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/hooks/queryKeys';
import { useRepositories } from '@/hooks/useRepositories';

import type { AppSettings, UserProfile } from './schema';

export function useProfile() {
  const repos = useRepositories();
  return useQuery({ queryKey: queryKeys.profile, queryFn: () => repos.profile.getProfile() });
}

export function useSettings() {
  const repos = useRepositories();
  return useQuery({ queryKey: queryKeys.settings, queryFn: () => repos.profile.getSettings() });
}

export function useSaveProfile() {
  const repos = useRepositories();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (profile: UserProfile) => repos.profile.saveProfile(profile, Date.now()),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.profile }).then(() =>
      client.invalidateQueries({ queryKey: queryKeys.learning }),
    ),
  });
}

export function useUpdateSettings() {
  const repos = useRepositories();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AppSettings>) => repos.profile.updateSettings(patch),
    onSuccess: (settings) => {
      client.setQueryData(queryKeys.settings, settings);
      return client.invalidateQueries({ queryKey: queryKeys.learning });
    },
  });
}

export function useResetProgress() {
  const repos = useRepositories();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => repos.profile.resetProgress(),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.learning }),
  });
}
