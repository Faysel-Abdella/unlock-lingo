import { z } from 'zod';

import type { ExerciseType } from '@/types/learning';

/** ISO weekday: 1 = Monday … 7 = Sunday. Stored as bit (weekday - 1) in `days_mask`. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

/** A device alarm sound. */
export interface AlarmSound {
  uri: string;
  title: string;
}

export interface Alarm {
  id: string;
  label: string;
  hour: number;
  minute: number;
  /** Empty = rings once, at the next occurrence of the time. */
  days: Weekday[];
  enabled: boolean;
  /** Correct answers required to stop the alarm. */
  questionCount: number;
  /** Allowed exercise types. Empty = every alarm-suitable type. */
  challengeTypes: ExerciseType[];
  snoozeEnabled: boolean;
  snoozeMinutes: number;
  maxSnoozes: number;
  vibrate: boolean;
  /** Null = the system's default alarm sound. */
  sound: AlarmSound | null;
  /** Start quietly and reach full volume over a minute. */
  gradualVolume: boolean;
}

export type AlarmInput = Omit<Alarm, 'id'>;

export const ALARM_DEFAULTS: AlarmInput = {
  label: '',
  hour: 7,
  minute: 0,
  days: [1, 2, 3, 4, 5],
  enabled: true,
  questionCount: 5,
  challengeTypes: [],
  snoozeEnabled: true,
  snoozeMinutes: 9,
  maxSnoozes: 3,
  vibrate: true,
  sound: null,
  gradualVolume: true,
};

export const QUESTION_COUNT_RANGE = { min: 1, max: 15 } as const;
export const SNOOZE_MINUTES_RANGE = { min: 1, max: 30 } as const;
export const MAX_SNOOZES_RANGE = { min: 0, max: 10 } as const;

/** Exercise types an alarm challenge may use. */
export const ALARM_EXERCISE_TYPES: readonly ExerciseType[] = [
  'meaning',
  'choose_word',
  'fill_blank',
  'synonym',
  'antonym',
  'translate',
  'grammar_choice',
  'phrase_meaning',
  'listening',
];

/**
 * Used when an alarm has no explicit selection. Listening is left out because the
 * alarm sound plays over it; users can opt in per alarm.
 */
export const DEFAULT_ALARM_EXERCISE_TYPES: readonly ExerciseType[] = ALARM_EXERCISE_TYPES.filter(
  (t) => t !== 'listening',
);

export function effectiveChallengeTypes(alarm: Pick<Alarm, 'challengeTypes'>): readonly ExerciseType[] {
  const chosen = alarm.challengeTypes.filter((t) => ALARM_EXERCISE_TYPES.includes(t));
  return chosen.length > 0 ? chosen : DEFAULT_ALARM_EXERCISE_TYPES;
}

/** The ringing service stops on its own after this long, whatever the UI does. */
export const MAX_RING_MINUTES = 10;

const weekdaySchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]);

/** Validates alarm input from the editor before it reaches storage or the native scheduler. */
export const alarmInputSchema = z.object({
  label: z.string().trim().max(60),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  days: z.array(weekdaySchema).transform((days) => [...new Set(days)].sort((a, b) => a - b)),
  enabled: z.boolean(),
  questionCount: z.number().int().min(QUESTION_COUNT_RANGE.min).max(QUESTION_COUNT_RANGE.max),
  challengeTypes: z.array(z.string()).transform((types) =>
    types.filter((t): t is ExerciseType => (ALARM_EXERCISE_TYPES as readonly string[]).includes(t)),
  ),
  snoozeEnabled: z.boolean(),
  snoozeMinutes: z.number().int().min(SNOOZE_MINUTES_RANGE.min).max(SNOOZE_MINUTES_RANGE.max),
  maxSnoozes: z.number().int().min(MAX_SNOOZES_RANGE.min).max(MAX_SNOOZES_RANGE.max),
  vibrate: z.boolean(),
  sound: z.object({ uri: z.string().min(1).max(500), title: z.string().trim().min(1).max(120) }).nullable(),
  gradualVolume: z.boolean(),
});
