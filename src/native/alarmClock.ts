import { requireOptionalNativeModule } from 'expo';
import { z } from 'zod';

/**
 * Typed bridge to the local `alarm-clock` Expo module (modules/alarm-clock, Kotlin).
 * When the native module is unavailable (iOS, tests, a build without it) every
 * call is a safe no-op and `isAvailable` is false, so callers can explain why
 * alarms are off instead of crashing.
 */
export interface NativeAlarmSpec {
  id: string;
  label: string;
  hour: number;
  minute: number;
  /** Bit (isoWeekday - 1). 0 = once. */
  daysMask: number;
  enabled: boolean;
  vibrate: boolean;
  snoozeEnabled: boolean;
  snoozeMinutes: number;
  maxSnoozes: number;
}

export interface AlarmPermissionStatus {
  exactAlarms: boolean;
  fullScreenIntent: boolean;
  notifications: boolean;
  batteryOptimizationIgnored: boolean;
}

export type StopMethod = 'challenge' | 'emergency';

export interface Subscription {
  remove(): void;
}

interface AlarmClockNativeModule {
  addListener(event: 'onRingingChanged', listener: (event: { alarmId: string | null }) => void): Subscription;
  setAlarms(specs: NativeAlarmSpec[]): Promise<Record<string, number | null>>;
  getRinging(): unknown;
  stopRinging(method: StopMethod): Promise<void>;
  snooze(): Promise<void>;
  consumeEvents(): unknown;
  getPermissionStatus(): unknown;
  openExactAlarmSettings(): void;
  openFullScreenIntentSettings(): void;
  openNotificationSettings(): void;
  openBatteryOptimizationSettings(): void;
}

const native = requireOptionalNativeModule<AlarmClockNativeModule>('AlarmClock');

export const ringingSchema = z.object({
  alarmId: z.string(),
  firedAt: z.number(),
  snoozeCount: z.number(),
});
export type RingingAlarm = z.infer<typeof ringingSchema>;

/** Outcomes logged natively, imported into `alarm_history` by the sync service. */
export const nativeAlarmEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('fired'), alarmId: z.string(), at: z.number(), snoozeCount: z.number().optional() }),
  z.object({ type: z.literal('snoozed'), alarmId: z.string(), at: z.number(), until: z.number().optional() }),
  z.object({
    type: z.literal('stopped'),
    alarmId: z.string(),
    at: z.number(),
    method: z.enum(['challenge', 'emergency', 'timeout']),
  }),
  z.object({ type: z.literal('disabled'), alarmId: z.string(), at: z.number() }),
]);
export type NativeAlarmEvent = z.infer<typeof nativeAlarmEventSchema>;

const permissionSchema = z.object({
  exactAlarms: z.boolean(),
  fullScreenIntent: z.boolean(),
  notifications: z.boolean(),
  batteryOptimizationIgnored: z.boolean(),
});

export const alarmClock = {
  isAvailable: native !== null,

  async setAlarms(specs: NativeAlarmSpec[]): Promise<Record<string, number | null>> {
    return native ? native.setAlarms(specs) : {};
  },

  getRinging(): RingingAlarm | null {
    const parsed = ringingSchema.safeParse(native?.getRinging());
    return parsed.success ? parsed.data : null;
  },

  async stopRinging(method: StopMethod): Promise<void> {
    await native?.stopRinging(method);
  },

  async snooze(): Promise<void> {
    await native?.snooze();
  },

  /** Returns and clears the native outcome log. Malformed entries are dropped. */
  consumeEvents(): NativeAlarmEvent[] {
    const raw = native?.consumeEvents();
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((e: unknown) => {
      const parsed = nativeAlarmEventSchema.safeParse(e);
      return parsed.success ? [parsed.data] : [];
    });
  },

  getPermissionStatus(): AlarmPermissionStatus | null {
    if (!native) return null;
    const parsed = permissionSchema.safeParse(native.getPermissionStatus());
    return parsed.success ? parsed.data : null;
  },

  onRingingChanged(listener: (alarmId: string | null) => void): Subscription | null {
    return native?.addListener('onRingingChanged', (e) => listener(e.alarmId)) ?? null;
  },

  openExactAlarmSettings: () => native?.openExactAlarmSettings(),
  openFullScreenIntentSettings: () => native?.openFullScreenIntentSettings(),
  openNotificationSettings: () => native?.openNotificationSettings(),
  openBatteryOptimizationSettings: () => native?.openBatteryOptimizationSettings(),
};
