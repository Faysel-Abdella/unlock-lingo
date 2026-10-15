import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useSettings, useUpdateSettings } from '@/features/settings/hooks';
import { queryKeys } from '@/hooks/queryKeys';
import { useRepositories } from '@/hooks/useRepositories';
import { reminderScheduler } from '@/services/notifications/reminders';

import { syncWeeklyReminder } from './reminderService';

/** Keeps the weekly reminder scheduled; re-runs on settings changes, new activity and resume. */
export function useWeeklyReminderSync() {
  const repos = useRepositories();
  const client = useQueryClient();
  const settings = useSettings().data;
  useQuery({
    queryKey: [...queryKeys.weeklyReminder, settings?.weeklyReminder, settings?.weeklyReviewDay],
    enabled: !!settings && reminderScheduler.available,
    queryFn: async () => (await syncWeeklyReminder(repos, settings!, reminderScheduler, Date.now())) ?? null,
  });
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void client.invalidateQueries({ queryKey: queryKeys.weeklyReminder });
    });
    return () => sub.remove();
  }, [client]);
}

export function useNotificationPermission() {
  return useQuery({
    queryKey: queryKeys.notificationPermission,
    enabled: reminderScheduler.available,
    queryFn: () => reminderScheduler.getPermission(),
    staleTime: 0,
  });
}

/** Turns the reminder on or off, asking for notification permission when turning it on. */
export function useSetWeeklyReminder() {
  const client = useQueryClient();
  const settings = useSettings().data;
  const update = useUpdateSettings();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!settings) return 'undetermined' as const;
      const permission = enabled ? await reminderScheduler.requestPermission() : await reminderScheduler.getPermission();
      await update.mutateAsync({ weeklyReminder: { ...settings.weeklyReminder, enabled: enabled && permission === 'granted' } });
      return permission;
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.notificationPermission }),
  });
}
