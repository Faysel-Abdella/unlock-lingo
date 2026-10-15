import type { DailyActivity } from '@/features/learning/domain/stats';
import type { WeekBucket } from '@/features/progress/domain/analytics';
import { parseDateKey, weekdayShort } from '@/utils/date';

import { BarChart } from './BarChart';

/** Seven-day activity bars, with the daily goal as the minimum scale. */
export function WeekChart({ days, goal }: { days: DailyActivity[]; goal: number }) {
  return (
    <BarChart
      minMax={goal}
      accessibilityLabel={`Last 7 days: ${days.map((d) => `${weekdayShort(d.date)} ${d.interactions}`).join(', ')}`}
      bars={days.map((d, i) => ({ key: d.date, label: weekdayShort(d.date), value: d.interactions, current: i === days.length - 1 }))}
    />
  );
}

function shortDate(key: string): string {
  return parseDateKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Weekly totals over a longer period; every third week is labelled to keep the axis readable. */
export function WeeksChart({ weeks, goal }: { weeks: WeekBucket[]; goal: number }) {
  return (
    <BarChart
      minMax={goal * 7}
      accessibilityLabel={`Last ${weeks.length} weeks: ${weeks.map((w) => `week of ${shortDate(w.start)} ${w.interactions}`).join(', ')}`}
      bars={weeks.map((w, i) => ({
        key: w.start,
        label: (weeks.length - 1 - i) % 3 === 0 ? shortDate(w.start) : '',
        value: w.interactions,
        current: i === weeks.length - 1,
      }))}
    />
  );
}
