export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export interface ScheduledReminder {
  at: number;
  title: string;
  body: string;
  /** In-app route opened when the notification is tapped. */
  url: string;
}

/** Schedules the single weekly-review reminder. Injected so services stay testable. */
export interface ReminderScheduler {
  readonly available: boolean;
  getPermission(): Promise<NotificationPermission>;
  requestPermission(): Promise<NotificationPermission>;
  /** Replaces any previously scheduled reminder. */
  schedule(reminder: ScheduledReminder): Promise<void>;
  cancel(): Promise<void>;
}
