import { type DailyActivity, emptyDay } from '@/features/learning/domain/stats';
import type { Database } from '@/services/database/types';
import { type DateKey, addDays } from '@/utils/date';

interface ActivityRow {
  date: string;
  interactions: number;
  correct: number;
  incorrect: number;
  new_items: number;
  reviews: number;
  grammar_answered: number;
  unlock_cards_shown: number;
  alarm_challenges: number;
}

function fromRow(row: ActivityRow): DailyActivity {
  return {
    date: row.date,
    interactions: row.interactions,
    correct: row.correct,
    incorrect: row.incorrect,
    newItems: row.new_items,
    reviews: row.reviews,
    grammarAnswered: row.grammar_answered,
    unlockCardsShown: row.unlock_cards_shown,
    alarmChallenges: row.alarm_challenges,
  };
}

export type ActivityIncrement = Partial<Omit<DailyActivity, 'date'>>;

const COLUMN: Record<keyof ActivityIncrement, string> = {
  interactions: 'interactions',
  correct: 'correct',
  incorrect: 'incorrect',
  newItems: 'new_items',
  reviews: 'reviews',
  grammarAnswered: 'grammar_answered',
  unlockCardsShown: 'unlock_cards_shown',
  alarmChallenges: 'alarm_challenges',
};

export interface ActivityRepository {
  getDay(date: DateKey): Promise<DailyActivity>;
  /** Inclusive range, with empty days filled in, oldest first. */
  getRange(from: DateKey, to: DateKey): Promise<DailyActivity[]>;
  getActiveDays(limit?: number): Promise<DateKey[]>;
  increment(date: DateKey, delta: ActivityIncrement, now: number): Promise<void>;
}

export function createActivityRepository(db: Database): ActivityRepository {
  return {
    async getDay(date) {
      const row = await db.getFirstAsync<ActivityRow>('SELECT * FROM daily_activity WHERE date = ?', [date]);
      return row ? fromRow(row) : emptyDay(date);
    },

    async getRange(from, to) {
      const rows = await db.getAllAsync<ActivityRow>(
        'SELECT * FROM daily_activity WHERE date BETWEEN ? AND ? ORDER BY date',
        [from, to],
      );
      const byDate = new Map(rows.map((r) => [r.date, fromRow(r)]));
      const days: DailyActivity[] = [];
      for (let d = from; d <= to; d = addDays(d, 1)) days.push(byDate.get(d) ?? emptyDay(d));
      return days;
    },

    async getActiveDays(limit = 400) {
      const rows = await db.getAllAsync<{ date: string }>(
        'SELECT date FROM daily_activity WHERE interactions > 0 ORDER BY date DESC LIMIT ?',
        [limit],
      );
      return rows.map((r) => r.date);
    },

    async increment(date, delta, now) {
      const entries = (Object.keys(delta) as (keyof ActivityIncrement)[]).filter((k) => (delta[k] ?? 0) !== 0);
      if (entries.length === 0) return;
      const columns = entries.map((k) => COLUMN[k]);
      const values = entries.map((k) => delta[k] ?? 0);
      await db.runAsync(
        `INSERT INTO daily_activity (date, ${columns.join(', ')}, updated_at)
         VALUES (?, ${columns.map(() => '?').join(', ')}, ?)
         ON CONFLICT (date) DO UPDATE SET
           ${columns.map((c) => `${c} = ${c} + excluded.${c}`).join(', ')},
           updated_at = excluded.updated_at`,
        [date, ...values, now],
      );
    },
  };
}
