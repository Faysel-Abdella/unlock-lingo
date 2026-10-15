import { z } from 'zod';

import { type DismissMethod } from '@/features/alarms/domain/challenge';
import { daysToMask, maskToDays } from '@/features/alarms/domain/schedule';
import { type Alarm, type AlarmInput, alarmInputSchema } from '@/features/alarms/domain/types';
import type { Database } from '@/services/database/types';
import { createId } from '@/utils/random';

import { fromBool, parseJson, toBool } from './rows';

interface AlarmRow {
  id: string;
  label: string;
  hour: number;
  minute: number;
  days_mask: number;
  enabled: number;
  question_count: number;
  challenge_types: string;
  snooze_enabled: number;
  snooze_minutes: number;
  max_snoozes: number;
  vibrate: number;
  sound_uri: string | null;
  sound_title: string | null;
  gradual_volume: number;
}

export interface AlarmHistoryEntry {
  id: number;
  alarmId: string | null;
  firedAt: number;
  dismissedAt: number | null;
  dismissMethod: DismissMethod | null;
  snoozeCount: number;
  questionsAnswered: number;
  questionsCorrect: number;
}

export interface AlarmOutcome {
  dismissedAt: number;
  method: DismissMethod;
  snoozeCount: number;
  questionsAnswered: number;
  questionsCorrect: number;
}

export interface AlarmRepository {
  list(): Promise<Alarm[]>;
  get(id: string): Promise<Alarm | null>;
  create(input: AlarmInput, now: number): Promise<Alarm>;
  update(id: string, input: AlarmInput, now: number): Promise<Alarm>;
  setEnabled(id: string, enabled: boolean, now: number): Promise<void>;
  remove(id: string): Promise<void>;
  /** Starts a history entry when an alarm rings. Returns its id. */
  recordFired(alarmId: string, firedAt: number): Promise<number>;
  recordSnoozed(historyId: number): Promise<void>;
  recordOutcome(historyId: number, outcome: AlarmOutcome): Promise<void>;
  /** The latest entry for an alarm that has not been dismissed yet. */
  findOpenEntry(alarmId: string): Promise<AlarmHistoryEntry | null>;
  closeEntry(historyId: number, dismissedAt: number, method: DismissMethod): Promise<void>;
  setQuestionCounts(historyId: number, answered: number, correct: number): Promise<void>;
  recentHistory(limit?: number): Promise<AlarmHistoryEntry[]>;
}

const stringList = z.array(z.string());

interface HistoryRow {
  id: number;
  alarm_id: string | null;
  fired_at: number;
  dismissed_at: number | null;
  dismiss_method: DismissMethod | null;
  snooze_count: number;
  questions_answered: number;
  questions_correct: number;
}

function historyFromRow(r: HistoryRow): AlarmHistoryEntry {
  return {
    id: r.id,
    alarmId: r.alarm_id,
    firedAt: r.fired_at,
    dismissedAt: r.dismissed_at,
    dismissMethod: r.dismiss_method,
    snoozeCount: r.snooze_count,
    questionsAnswered: r.questions_answered,
    questionsCorrect: r.questions_correct,
  };
}

function fromRow(row: AlarmRow): Alarm {
  return {
    id: row.id,
    ...alarmInputSchema.parse({
      label: row.label,
      hour: row.hour,
      minute: row.minute,
      days: maskToDays(row.days_mask),
      enabled: toBool(row.enabled),
      questionCount: row.question_count,
      challengeTypes: parseJson(stringList, row.challenge_types, []),
      snoozeEnabled: toBool(row.snooze_enabled),
      snoozeMinutes: row.snooze_minutes,
      maxSnoozes: row.max_snoozes,
      vibrate: toBool(row.vibrate),
      sound: row.sound_uri ? { uri: row.sound_uri, title: row.sound_title ?? 'Alarm sound' } : null,
      gradualVolume: toBool(row.gradual_volume),
    }),
  };
}

function values(a: AlarmInput): (string | number | null)[] {
  return [
    a.label,
    a.hour,
    a.minute,
    daysToMask(a.days),
    fromBool(a.enabled),
    a.questionCount,
    JSON.stringify(a.challengeTypes),
    fromBool(a.snoozeEnabled),
    a.snoozeMinutes,
    a.maxSnoozes,
    fromBool(a.vibrate),
    a.sound?.uri ?? null,
    a.sound?.title ?? null,
    fromBool(a.gradualVolume),
  ];
}

export function createAlarmRepository(db: Database): AlarmRepository {
  async function get(id: string): Promise<Alarm | null> {
    const row = await db.getFirstAsync<AlarmRow>('SELECT * FROM alarms WHERE id = ?', [id]);
    return row ? fromRow(row) : null;
  }

  async function mustGet(id: string): Promise<Alarm> {
    const alarm = await get(id);
    if (!alarm) throw new Error(`Alarm ${id} not found`);
    return alarm;
  }

  return {
    async list() {
      const rows = await db.getAllAsync<AlarmRow>('SELECT * FROM alarms ORDER BY hour, minute, created_at', []);
      return rows.map(fromRow);
    },

    get,

    async create(input, now) {
      const alarm = alarmInputSchema.parse(input);
      const id = createId('alarm-');
      await db.runAsync(
        `INSERT INTO alarms (id, label, hour, minute, days_mask, enabled, question_count, challenge_types,
           snooze_enabled, snooze_minutes, max_snoozes, vibrate, sound_uri, sound_title, gradual_volume,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, ...values(alarm), now, now],
      );
      return mustGet(id);
    },

    async update(id, input, now) {
      const alarm = alarmInputSchema.parse(input);
      await db.runAsync(
        `UPDATE alarms SET label = ?, hour = ?, minute = ?, days_mask = ?, enabled = ?, question_count = ?,
           challenge_types = ?, snooze_enabled = ?, snooze_minutes = ?, max_snoozes = ?, vibrate = ?,
           sound_uri = ?, sound_title = ?, gradual_volume = ?, updated_at = ?
         WHERE id = ?`,
        [...values(alarm), now, id],
      );
      return mustGet(id);
    },

    async setEnabled(id, enabled, now) {
      await db.runAsync('UPDATE alarms SET enabled = ?, updated_at = ? WHERE id = ?', [fromBool(enabled), now, id]);
    },

    async remove(id) {
      await db.runAsync('DELETE FROM alarms WHERE id = ?', [id]);
    },

    async recordFired(alarmId, firedAt) {
      const result = await db.runAsync('INSERT INTO alarm_history (alarm_id, fired_at) VALUES (?, ?)', [alarmId, firedAt]);
      return result.lastInsertRowId;
    },

    async recordSnoozed(historyId) {
      await db.runAsync('UPDATE alarm_history SET snooze_count = snooze_count + 1 WHERE id = ?', [historyId]);
    },

    async recordOutcome(historyId, o) {
      await db.runAsync(
        `UPDATE alarm_history SET dismissed_at = ?, dismiss_method = ?, snooze_count = ?,
           questions_answered = ?, questions_correct = ? WHERE id = ?`,
        [o.dismissedAt, o.method, o.snoozeCount, o.questionsAnswered, o.questionsCorrect, historyId],
      );
    },

    async recentHistory(limit = 30) {
      const rows = await db.getAllAsync<HistoryRow>('SELECT * FROM alarm_history ORDER BY fired_at DESC, id DESC LIMIT ?', [
        limit,
      ]);
      return rows.map(historyFromRow);
    },

    async findOpenEntry(alarmId) {
      const row = await db.getFirstAsync<HistoryRow>(
        'SELECT * FROM alarm_history WHERE alarm_id = ? AND dismissed_at IS NULL ORDER BY fired_at DESC, id DESC LIMIT 1',
        [alarmId],
      );
      return row ? historyFromRow(row) : null;
    },

    async closeEntry(historyId, dismissedAt, method) {
      await db.runAsync(
        'UPDATE alarm_history SET dismissed_at = ?, dismiss_method = ? WHERE id = ? AND dismissed_at IS NULL',
        [dismissedAt, method, historyId],
      );
    },

    async setQuestionCounts(historyId, answered, correct) {
      await db.runAsync('UPDATE alarm_history SET questions_answered = ?, questions_correct = ? WHERE id = ?', [
        answered,
        correct,
        historyId,
      ]);
    },
  };
}
