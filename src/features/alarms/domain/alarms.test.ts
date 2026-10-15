import {
  answerChallenge,
  canStopAlarm,
  createChallenge,
  dismissMethod,
  emergencyDismiss,
  questionsExhausted,
  remainingCorrect,
} from './challenge';
import {
  daysToMask,
  describeRepeat,
  describeTimeUntil,
  maskToDays,
  nextEnabledAlarm,
  nextOccurrence,
  snoozeDecision,
} from './schedule';
import { ALARM_DEFAULTS, type Alarm, effectiveChallengeTypes } from './types';


const local = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const alarm = (overrides: Partial<Alarm> = {}): Alarm => ({ id: 'a', ...ALARM_DEFAULTS, ...overrides });

describe('repeat days', () => {
  it('round-trips the weekday bitmask (bit 0 = Monday)', () => {
    expect(daysToMask([1])).toBe(1);
    expect(daysToMask([7])).toBe(64);
    expect(maskToDays(daysToMask([1, 3, 7]))).toEqual([1, 3, 7]);
  });

  it('describes common repeat patterns', () => {
    expect(describeRepeat([])).toBe('Once');
    expect(describeRepeat([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(describeRepeat([6, 7])).toBe('Weekends');
    expect(describeRepeat([1, 2, 3, 4, 5, 6, 7])).toBe('Every day');
    expect(describeRepeat([3, 1])).toBe('Mon, Wed');
  });
});

describe('nextOccurrence', () => {
  // 2026-03-11 is a Wednesday.
  const wed0600 = local(2026, 3, 11, 6, 0);

  it('rings later today when the time has not passed', () => {
    expect(nextOccurrence(alarm({ hour: 7, days: [] }), wed0600)).toBe(local(2026, 3, 11, 7, 0));
  });

  it('rings tomorrow when the time has passed, and never at the exact current minute', () => {
    expect(nextOccurrence(alarm({ hour: 5, days: [] }), wed0600)).toBe(local(2026, 3, 12, 5, 0));
    expect(nextOccurrence(alarm({ hour: 6, minute: 0, days: [] }), wed0600)).toBe(local(2026, 3, 12, 6, 0));
  });

  it('skips to the next selected weekday', () => {
    // Weekdays alarm at 7:00 checked on Friday 8:00 → Monday.
    expect(nextOccurrence(alarm({ hour: 7, days: [1, 2, 3, 4, 5] }), local(2026, 3, 13, 8))).toBe(local(2026, 3, 16, 7));
    // Wednesday-only alarm after it rang → next Wednesday.
    expect(nextOccurrence(alarm({ hour: 7, days: [3] }), local(2026, 3, 11, 7, 1))).toBe(local(2026, 3, 18, 7));
  });

  it('keeps the wall-clock time across a DST change', () => {
    // Europe/Berlin springs forward on 2026-03-29.
    const next = nextOccurrence(alarm({ hour: 7, days: [7] }), local(2026, 3, 28, 12));
    expect(new Date(next!).getHours()).toBe(7);
    expect(new Date(next!).getDate()).toBe(29);
  });

  it('returns null when disabled and picks the soonest enabled alarm', () => {
    expect(nextOccurrence(alarm({ enabled: false }), wed0600)).toBeNull();
    const result = nextEnabledAlarm(
      [alarm({ id: 'late', hour: 9, days: [] }), alarm({ id: 'early', hour: 6, minute: 30, days: [] }), alarm({ id: 'off', enabled: false })],
      wed0600,
    );
    expect(result?.alarm.id).toBe('early');
  });

  it('formats a countdown', () => {
    expect(describeTimeUntil(wed0600 + 90 * 60_000, wed0600)).toBe('in 1 h 30 min');
    expect(describeTimeUntil(wed0600 + 30_000, wed0600)).toBe('in 1 min');
    expect(describeTimeUntil(wed0600 + 2 * 86_400_000 + 3_600_000, wed0600)).toBe('in 2 d 1 h');
  });
});

describe('snooze', () => {
  it('allows snoozing until the limit', () => {
    const a = alarm({ snoozeMinutes: 9, maxSnoozes: 2 });
    expect(snoozeDecision(a, 0, 0)).toEqual({ allowed: true, remaining: 2, until: 9 * 60_000 });
    expect(snoozeDecision(a, 2, 0).allowed).toBe(false);
    expect(snoozeDecision(alarm({ snoozeEnabled: false }), 0, 0).allowed).toBe(false);
  });
});

describe('alarm challenge', () => {
  it('completes after the required number of correct answers; mistakes only cost another question', () => {
    let c = createChallenge(3, 10);
    for (const correct of [true, false, true, false]) c = answerChallenge(c, correct);
    expect(canStopAlarm(c)).toBe(false);
    expect(remainingCorrect(c)).toBe(1);
    c = answerChallenge(c, true);
    expect(c).toMatchObject({ status: 'completed', correct: 3, attempts: 5 });
    expect(canStopAlarm(c)).toBe(true);
    expect(dismissMethod(c)).toBe('challenge');
  });

  it('can always be dismissed in an emergency', () => {
    const c = emergencyDismiss(createChallenge(5, 10));
    expect(canStopAlarm(c)).toBe(true);
    expect(dismissMethod(c)).toBe('emergency');
  });

  it('never traps the user when there are no questions', () => {
    expect(canStopAlarm(createChallenge(5, 0))).toBe(true);
    expect(canStopAlarm(questionsExhausted(createChallenge(5, 3)))).toBe(true);
  });

  it('ignores answers once resolved and clamps the requirement to at least one', () => {
    const done = answerChallenge(createChallenge(1, 5), true);
    expect(answerChallenge(done, false)).toBe(done);
    expect(createChallenge(0, 5).required).toBe(1);
  });
});

describe('challenge types', () => {
  it('defaults to every type except listening, and filters unsupported selections', () => {
    expect(effectiveChallengeTypes({ challengeTypes: [] })).not.toContain('listening');
    expect(effectiveChallengeTypes({ challengeTypes: ['listening', 'intro'] })).toEqual(['listening']);
  });
});
