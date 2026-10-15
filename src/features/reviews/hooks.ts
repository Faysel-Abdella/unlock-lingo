import { useQuery } from '@tanstack/react-query';

import { useProfile, useSettings } from '@/features/settings/hooks';
import { queryKeys } from '@/hooks/queryKeys';
import { useRepositories } from '@/hooks/useRepositories';
import { useToday } from '@/hooks/useToday';

import { loadWeeklyReview } from './weeklyService';

export function useWeeklyReview() {
  const repos = useRepositories();
  const today = useToday();
  const profile = useProfile().data;
  const settings = useSettings().data;
  return useQuery({
    queryKey: [...queryKeys.weekly(today), settings?.weeklyReviewDay],
    enabled: !!profile && !!settings,
    queryFn: () => loadWeeklyReview(repos, profile!, settings!, Date.now()),
  });
}

export function useWeeklyHistory() {
  const repos = useRepositories();
  return useQuery({ queryKey: queryKeys.weeklyHistory, queryFn: () => repos.weekly.listSnapshots(8) });
}
