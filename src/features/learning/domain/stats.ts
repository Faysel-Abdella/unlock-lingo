import { type DateKey, addDays } from '@/utils/date';

export interface DailyActivity {
  date: DateKey;
  interactions: number;
  correct: number;
  incorrect: number;
  newItems: number;
  reviews: number;
  grammarAnswered: number;
  unlockCardsShown: number;
  alarmChallenges: number;
}

export function emptyDay(date: DateKey): DailyActivity {
  return {
    date,
    interactions: 0,
    correct: 0,
    incorrect: 0,
    newItems: 0,
    reviews: 0,
    grammarAnswered: 0,
    unlockCardsShown: 0,
    alarmChallenges: 0,
  };
}

export interface StreakInfo {
  current: number;
  longest: number;
  /** True when today already counts towards the streak. */
  activeToday: boolean;
}

/**
 * A day counts towards the streak when the learner had at least one interaction.
 * The current streak stays alive until the end of today, so a learner who studied
 * yesterday but not yet today still sees their streak.
 */
export function computeStreak(activeDays: Iterable<DateKey>, today: DateKey): StreakInfo {
  const days = new Set(activeDays);
  const activeToday = days.has(today);

  let current = 0;
  let cursor = activeToday ? today : addDays(today, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  for (const day of days) {
    if (days.has(addDays(day, -1))) continue; // not the start of a run
    let length = 0;
    let d = day;
    while (days.has(d)) {
      length++;
      d = addDays(d, 1);
    }
    longest = Math.max(longest, length);
  }

  return { current, longest: Math.max(longest, current), activeToday };
}

export function accuracy(correct: number, incorrect: number): number | null {
  const total = correct + incorrect;
  return total === 0 ? null : correct / total;
}

export function sumActivity(days: readonly DailyActivity[]): Omit<DailyActivity, 'date'> {
  const total = emptyDay('');
  for (const d of days) {
    total.interactions += d.interactions;
    total.correct += d.correct;
    total.incorrect += d.incorrect;
    total.newItems += d.newItems;
    total.reviews += d.reviews;
    total.grammarAnswered += d.grammarAnswered;
    total.unlockCardsShown += d.unlockCardsShown;
    total.alarmChallenges += d.alarmChallenges;
  }
  const { date: _date, ...rest } = total;
  return rest;
}
