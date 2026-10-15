import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useProfile, useSettings } from '@/features/settings/hooks';
import { queryKeys } from '@/hooks/queryKeys';
import { useRepositories } from '@/hooks/useRepositories';
import { useToday } from '@/hooks/useToday';
import type { RecordReviewInput } from '@/repositories/progressRepository';

import { loadDashboard, loadWeek } from './learningService';

export function useDashboard() {
  const repos = useRepositories();
  const today = useToday();
  const profile = useProfile().data;
  const settings = useSettings().data;
  return useQuery({
    queryKey: queryKeys.dashboard(today),
    enabled: !!profile && !!settings,
    queryFn: () => loadDashboard(repos, profile!, settings!, Date.now()),
  });
}

export function useWeek() {
  const repos = useRepositories();
  const today = useToday();
  return useQuery({ queryKey: queryKeys.week(today), queryFn: () => loadWeek(repos, Date.now()) });
}

export function useItem(id: string) {
  const repos = useRepositories();
  return useQuery({
    queryKey: queryKeys.item(id),
    queryFn: async () => {
      const [item, progress, personal] = await Promise.all([
        repos.content.getItem(id),
        repos.progress.getProgress(id),
        repos.personal.findByItemId(id),
      ]);
      return { item, progress, personal };
    },
  });
}

/** Records an answer. Callers refresh learning queries once a batch (e.g. a session) ends. */
export function useRecordReview() {
  const repos = useRepositories();
  return useMutation({ mutationFn: (input: RecordReviewInput) => repos.progress.recordReview(input) });
}

export function useInvalidateLearning() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.learning });
}
