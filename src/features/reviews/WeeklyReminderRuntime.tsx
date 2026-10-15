import { type Href, router, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';

import { onReminderOpened, showRemindersInForeground } from '@/services/notifications/reminders';

import { useWeeklyReminderSync } from './reminderHooks';

/** Keeps the weekly reminder scheduled and opens the review when it is tapped. Renders nothing. */
export function WeeklyReminderRuntime() {
  useWeeklyReminderSync();
  const navigationReady = !!useRootNavigationState()?.key;

  useEffect(() => {
    showRemindersInForeground();
  }, []);

  useEffect(() => {
    if (!navigationReady) return;
    return onReminderOpened((url) => router.push(url as Href));
  }, [navigationReady]);

  return null;
}
