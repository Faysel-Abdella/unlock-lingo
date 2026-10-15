import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationPermission, ReminderScheduler } from './types';

const REMINDER_ID = 'weekly-review-reminder';
const CHANNEL_ID = 'weekly-review';

function toPermission(status: Notifications.PermissionStatus): NotificationPermission {
  if (status === Notifications.PermissionStatus.GRANTED) return 'granted';
  if (status === Notifications.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Weekly review',
    description: 'A reminder on your review day when the weekly review is ready',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** expo-notifications backed scheduler (Android and iOS). */
export const reminderScheduler: ReminderScheduler = {
  available: true,

  async getPermission() {
    return toPermission((await Notifications.getPermissionsAsync()).status);
  },

  async requestPermission() {
    await ensureChannel();
    return toPermission((await Notifications.requestPermissionsAsync()).status);
  },

  async schedule({ at, title, body, url }) {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: { title, body, data: { url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
    });
  },

  async cancel() {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  },
};

/** Shows reminders that fire while the app is open, too. */
export function showRemindersInForeground(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Calls `open` with the route of a tapped reminder, including the one that launched the app. */
export function onReminderOpened(open: (url: string) => void): () => void {
  const handle = (response: Notifications.NotificationResponse | null) => {
    const url: unknown = response?.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) open(url);
  };
  void Notifications.getLastNotificationResponseAsync().then(handle);
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
