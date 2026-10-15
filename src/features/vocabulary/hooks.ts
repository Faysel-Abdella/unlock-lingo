import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useProfile } from '@/features/settings/hooks';
import { queryKeys } from '@/hooks/queryKeys';
import { useRepositories } from '@/hooks/useRepositories';
import type { WordDetails, WordSource } from '@/repositories/personalVocabularyRepository';
import type { CefrLevel } from '@/types/language';
import type { PersonalWordFlags } from '@/types/learning';

export function useVocabularyList(search: string, level: CefrLevel | null) {
  const repos = useRepositories();
  const language = useProfile().data?.targetLanguage ?? 'en';
  return useQuery({
    queryKey: queryKeys.vocabulary(search, level),
    queryFn: () => repos.content.listVocabulary({ language, search, level }),
  });
}

export function usePersonalWords() {
  const repos = useRepositories();
  return useQuery({ queryKey: queryKeys.personalWords, queryFn: () => repos.personal.list() });
}

export function usePersonalWord(id: string) {
  const repos = useRepositories();
  return useQuery({ queryKey: queryKeys.personalWord(id), queryFn: () => repos.personal.get(id) });
}

function useInvalidate() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.learning });
}

export function useAddWord() {
  const repos = useRepositories();
  const profile = useProfile().data;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { word: string; contextNote?: string | null; source?: WordSource }) =>
      repos.personal.add(
        {
          ...input,
          language: profile?.targetLanguage ?? 'en',
          defaultLevel: profile?.currentLevel ?? 'B1',
        },
        Date.now(),
      ),
    onSuccess: invalidate,
  });
}

export function useUpdateWordFlags() {
  const repos = useRepositories();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, flags }: { id: string; flags: Partial<PersonalWordFlags> }) =>
      repos.personal.updateFlags(id, flags, Date.now()),
    onSuccess: invalidate,
  });
}

export function useUpdateWordNote() {
  const repos = useRepositories();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, note, source }: { id: string; note: string | null; source: WordSource }) =>
      repos.personal.updateNote(id, note, source, Date.now()),
    onSuccess: invalidate,
  });
}

export function useUpdateWordDetails() {
  const repos = useRepositories();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, details }: { id: string; details: WordDetails }) =>
      repos.personal.updateDetails(id, details, Date.now()),
    onSuccess: invalidate,
  });
}

export function useRemoveWord() {
  const repos = useRepositories();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => repos.personal.remove(id), onSuccess: invalidate });
}
