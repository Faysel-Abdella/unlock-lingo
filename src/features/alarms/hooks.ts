import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

import { queryKeys } from '@/hooks/queryKeys';
import { useRepositories } from '@/hooks/useRepositories';
import { alarmClock } from '@/native/alarmClock';

import { syncAlarms } from './alarmService';
import { nextEnabledAlarm } from './domain/schedule';
import type { Alarm, AlarmInput } from './domain/types';

export function useAlarms() {
  const repos = useRepositories();
  return useQuery({ queryKey: queryKeys.alarms, queryFn: () => repos.alarms.list() });
}

export function useAlarm(id: string | null) {
  const repos = useRepositories();
  return useQuery({
    queryKey: queryKeys.alarm(id ?? 'new'),
    enabled: id !== null,
    queryFn: () => repos.alarms.get(id ?? ''),
  });
}

/** The soonest enabled alarm, recomputed whenever alarms change. */
export function useNextAlarm(now: number) {
  const { data } = useAlarms();
  return data ? nextEnabledAlarm(data, now) : null;
}

/** Re-sync after any change so the native schedule always mirrors SQLite. */
function useSyncingMutation<TVariables, TResult>(fn: (vars: TVariables) => Promise<TResult>) {
  const repos = useRepositories();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVariables) => {
      const result = await fn(vars);
      await syncAlarms(repos, alarmClock);
      return result;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.alarms }),
  });
}

export function useSaveAlarm() {
  const repos = useRepositories();
  return useSyncingMutation(({ id, input }: { id: string | null; input: AlarmInput }): Promise<Alarm> =>
    id ? repos.alarms.update(id, input, Date.now()) : repos.alarms.create(input, Date.now()),
  );
}

export function useToggleAlarm() {
  const repos = useRepositories();
  return useSyncingMutation(({ id, enabled }: { id: string; enabled: boolean }) =>
    repos.alarms.setEnabled(id, enabled, Date.now()),
  );
}

export function useDeleteAlarm() {
  const repos = useRepositories();
  return useSyncingMutation((id: string) => repos.alarms.remove(id));
}

/**
 * Keeps the native schedule in sync on launch and whenever the app returns to the
 * foreground (imports native outcomes, e.g. a one-time alarm that already rang).
 */
export function useAlarmSync() {
  const repos = useRepositories();
  const client = useQueryClient();
  useEffect(() => {
    const run = () =>
      syncAlarms(repos, alarmClock)
        .then(() => client.invalidateQueries({ queryKey: queryKeys.alarms }))
        .catch((e: unknown) => console.warn('Alarm sync failed', e));
    void run();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    return () => sub.remove();
  }, [repos, client]);
}

export function useAlarmPermissions() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.alarmPermissions,
    queryFn: () => alarmClock.getPermissionStatus(),
    staleTime: 0,
  });
  // Users grant permissions in system settings; re-check when they come back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void client.invalidateQueries({ queryKey: queryKeys.alarmPermissions });
    });
    return () => sub.remove();
  }, [client]);
  return query;
}

/** Android 13+ runtime notification permission. Returns true when granted (or not needed). */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/** Alarm sounds installed on the device (empty off Android). */
export function useAlarmSounds(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.alarmSounds,
    enabled: enabled && alarmClock.isAvailable,
    queryFn: () => alarmClock.listAlarmSounds(),
    staleTime: Infinity,
  });
}
