import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { alarmClock } from '@/native/alarmClock';

import { useAlarmSync } from './hooks';

const RING_PATH = '/alarm/ring';

/**
 * App-wide alarm plumbing: keeps the native schedule in sync and opens the
 * challenge when an alarm rings while the app is open (the full-screen intent
 * covers the locked/background case).
 */
export function AlarmRuntime() {
  useAlarmSync();
  const pathname = usePathname();
  const navigationReady = !!useRootNavigationState()?.key;

  useEffect(() => {
    if (!navigationReady) return;
    const openIfRinging = (alarmId: string | null) => {
      if (alarmId && pathname !== RING_PATH) router.push({ pathname: RING_PATH, params: { alarmId } });
    };
    openIfRinging(alarmClock.getRinging()?.alarmId ?? null);
    const ringingSub = alarmClock.onRingingChanged(openIfRinging);
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') openIfRinging(alarmClock.getRinging()?.alarmId ?? null);
    });
    return () => {
      ringingSub?.remove();
      appSub.remove();
    };
  }, [pathname, navigationReady]);

  return null;
}
