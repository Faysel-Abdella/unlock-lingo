import type { ReminderScheduler } from './types';

/** The web preview has no scheduled notifications. */
export const reminderScheduler: ReminderScheduler = {
  available: false,
  getPermission: async () => 'denied',
  requestPermission: async () => 'denied',
  schedule: async () => undefined,
  cancel: async () => undefined,
};

export function showRemindersInForeground(): void {}

export function onReminderOpened(): () => void {
  return () => undefined;
}
