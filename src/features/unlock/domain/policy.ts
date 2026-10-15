import { isoWeekday } from '@/features/alarms/domain/schedule';
import type { Weekday } from '@/features/alarms/domain/types';
import { type DateKey, toDateKey } from '@/utils/date';

/**
 * Interruption policy for unlock cards. Pure, and mirrored in Kotlin
 * (modules/unlock-cards/.../CardPolicy.kt) so the native side can decide on an
 * unlock without JS. Keep both in sync; both have unit tests for the same cases.
 */
export type Frequency = 'low' | 'normal' | 'high';

/** Minutes since local midnight, 0–1439. */
export type MinuteOfDay = number;

export interface TimeWindow {
  enabled: boolean;
  start: MinuteOfDay;
  end: MinuteOfDay;
}

export interface CardPolicyConfig {
  enabled: boolean;
  maxCardsPerDay: number;
  cooldownMinutes: number;
  quietHours: TimeWindow;
  /** No cards during work hours on the selected days. */
  workHours: TimeWindow & { days: Weekday[] };
  frequency: Frequency;
  /** Explicit opt-in: ignore cooldown and frequency (quiet hours and the daily cap still apply). */
  everyUnlock: boolean;
}

export interface CardPolicyState {
  /** Local day the counter belongs to. */
  day: DateKey | null;
  shownToday: number;
  lastShownAt: number | null;
}

export type SkipReason = 'disabled' | 'daily_limit' | 'cooldown' | 'quiet_hours' | 'work_hours' | 'frequency';
export type CardDecision = { show: true } | { show: false; reason: SkipReason };

/** Chance that an otherwise eligible unlock shows a card. */
export const FREQUENCY_PROBABILITY: Record<Frequency, number> = { low: 0.34, normal: 0.67, high: 1 };

export const EMPTY_STATE: CardPolicyState = { day: null, shownToday: 0, lastShownAt: null };

export function minuteOfDay(ms: number): MinuteOfDay {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

/** True when `minute` is inside [start, end). Windows may cross midnight; start === end is empty. */
export function inWindow(minute: MinuteOfDay, start: MinuteOfDay, end: MinuteOfDay): boolean {
  if (start === end) return false;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

export function shownToday(state: CardPolicyState, now: number): number {
  return state.day === toDateKey(now) ? state.shownToday : 0;
}

/** Why no card may be shown at `now` regardless of history, or null when the time is fine. */
export function blockedByTime(config: CardPolicyConfig, now: number): 'quiet_hours' | 'work_hours' | null {
  const minute = minuteOfDay(now);
  if (config.quietHours.enabled && inWindow(minute, config.quietHours.start, config.quietHours.end)) {
    return 'quiet_hours';
  }
  const work = config.workHours;
  if (work.enabled && work.days.includes(isoWeekday(new Date(now))) && inWindow(minute, work.start, work.end)) {
    return 'work_hours';
  }
  return null;
}

/**
 * Decides whether this unlock shows a card. `roll` is a uniform random number in
 * [0, 1), injected so the decision is testable.
 */
export function decide(config: CardPolicyConfig, state: CardPolicyState, now: number, roll: number): CardDecision {
  if (!config.enabled) return { show: false, reason: 'disabled' };
  if (shownToday(state, now) >= config.maxCardsPerDay) return { show: false, reason: 'daily_limit' };
  const blocked = blockedByTime(config, now);
  if (blocked) return { show: false, reason: blocked };
  if (!config.everyUnlock) {
    if (state.lastShownAt !== null && now - state.lastShownAt < config.cooldownMinutes * 60_000) {
      return { show: false, reason: 'cooldown' };
    }
    if (roll >= FREQUENCY_PROBABILITY[config.frequency]) return { show: false, reason: 'frequency' };
  }
  return { show: true };
}

export function recordShown(state: CardPolicyState, now: number): CardPolicyState {
  return { day: toDateKey(now), shownToday: shownToday(state, now) + 1, lastShownAt: now };
}

const SLOT_STEP_MS = 5 * 60_000;
const SEARCH_LIMIT_MS = 8 * 86_400_000;

/** Minutes per day outside quiet hours (work hours are ignored: they vary by weekday). */
function activeMinutesPerDay(config: CardPolicyConfig): number {
  const q = config.quietHours;
  if (!q.enabled || q.start === q.end) return 1440;
  const quiet = q.start < q.end ? q.end - q.start : 1440 - q.start + q.end;
  return Math.max(60, 1440 - quiet);
}

/**
 * Scheduled mode (no unlock detection): when the next card should appear.
 * Cards are spread evenly across the active part of the day, never closer than
 * the cooldown, never in quiet or work hours, and never above the daily cap.
 * Returns null when disabled or when no allowed time exists within a week.
 */
export function nextScheduledSlot(config: CardPolicyConfig, state: CardPolicyState, now: number): number | null {
  if (!config.enabled || config.maxCardsPerDay <= 0) return null;
  const spacingMs = Math.max(config.cooldownMinutes, activeMinutesPerDay(config) / config.maxCardsPerDay) * 60_000;
  let candidate = Math.max(now + 60_000, (state.lastShownAt ?? now) + spacingMs);
  // Align to a 5-minute grid so the search below steps cleanly.
  candidate = Math.ceil(candidate / SLOT_STEP_MS) * SLOT_STEP_MS;

  for (let t = candidate; t - candidate <= SEARCH_LIMIT_MS; t += SLOT_STEP_MS) {
    if (blockedByTime(config, t)) continue;
    // The cap is per local day: a slot on a later day starts from zero.
    if (shownToday(state, t) >= config.maxCardsPerDay) continue;
    return t;
  }
  return null;
}
