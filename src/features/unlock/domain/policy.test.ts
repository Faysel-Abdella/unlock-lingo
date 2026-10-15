import {
  type CardPolicyConfig,
  type CardPolicyState,
  EMPTY_STATE,
  decide,
  inWindow,
  minuteOfDay,
  nextScheduledSlot,
  recordShown,
} from './policy';

// Jest pins TZ=Europe/Berlin (see jest.global-setup.js). 2026-03-11 is a Wednesday.
const at = (h: number, m = 0, day = 11) => new Date(2026, 2, day, h, m).getTime();
const HM = (h: number, m = 0) => h * 60 + m;

const config = (overrides: Partial<CardPolicyConfig> = {}): CardPolicyConfig => ({
  enabled: true,
  maxCardsPerDay: 10,
  cooldownMinutes: 30,
  quietHours: { enabled: true, start: HM(23), end: HM(7) },
  workHours: { enabled: false, start: HM(9), end: HM(17), days: [1, 2, 3, 4, 5] },
  frequency: 'high',
  everyUnlock: false,
  ...overrides,
});

const shown = (times: number[]): CardPolicyState => times.reduce(recordShown, EMPTY_STATE);

describe('time windows', () => {
  it('handles windows inside a day and across midnight', () => {
    expect(inWindow(HM(10), HM(9), HM(17))).toBe(true);
    expect(inWindow(HM(17), HM(9), HM(17))).toBe(false);
    expect(inWindow(HM(23, 30), HM(23), HM(7))).toBe(true);
    expect(inWindow(HM(6, 59), HM(23), HM(7))).toBe(true);
    expect(inWindow(HM(7), HM(23), HM(7))).toBe(false);
    expect(inWindow(HM(12), HM(8), HM(8))).toBe(false);
  });

  it('reads local minutes of the day', () => {
    expect(minuteOfDay(at(13, 45))).toBe(HM(13, 45));
  });
});

describe('decide', () => {
  it('shows a card on an eligible unlock', () => {
    expect(decide(config(), EMPTY_STATE, at(12), 0.5)).toEqual({ show: true });
  });

  it('never shows anything when unlock learning is off', () => {
    expect(decide(config({ enabled: false }), EMPTY_STATE, at(12), 0)).toEqual({ show: false, reason: 'disabled' });
  });

  it('respects the cooldown between cards', () => {
    const state = shown([at(12)]);
    expect(decide(config(), state, at(12, 20), 0)).toEqual({ show: false, reason: 'cooldown' });
    expect(decide(config(), state, at(12, 30), 0)).toEqual({ show: true });
  });

  it('stops at the daily limit and resets the next day', () => {
    const state = shown([at(8), at(9), at(10)]);
    const cfg = config({ maxCardsPerDay: 3 });
    expect(decide(cfg, state, at(15), 0)).toEqual({ show: false, reason: 'daily_limit' });
    expect(decide(cfg, state, at(8, 0, 12), 0)).toEqual({ show: true });
  });

  it('stays silent during quiet hours, including after midnight', () => {
    expect(decide(config(), EMPTY_STATE, at(23, 15), 0)).toEqual({ show: false, reason: 'quiet_hours' });
    expect(decide(config(), EMPTY_STATE, at(6, 30), 0)).toEqual({ show: false, reason: 'quiet_hours' });
    expect(decide(config({ quietHours: { enabled: false, start: HM(23), end: HM(7) } }), EMPTY_STATE, at(6, 30), 0).show).toBe(true);
  });

  it('pauses during work hours only on work days', () => {
    const cfg = config({ workHours: { enabled: true, start: HM(9), end: HM(17), days: [1, 2, 3, 4, 5] } });
    expect(decide(cfg, EMPTY_STATE, at(10), 0)).toEqual({ show: false, reason: 'work_hours' });
    // Saturday 2026-03-14
    expect(decide(cfg, EMPTY_STATE, at(10, 0, 14), 0)).toEqual({ show: true });
  });

  it('applies frequency as a probability', () => {
    const low = config({ frequency: 'low' });
    expect(decide(low, EMPTY_STATE, at(12), 0.2)).toEqual({ show: true });
    expect(decide(low, EMPTY_STATE, at(12), 0.5)).toEqual({ show: false, reason: 'frequency' });
  });

  it('every-unlock mode skips cooldown and frequency but keeps quiet hours and the cap', () => {
    const cfg = config({ everyUnlock: true, frequency: 'low', maxCardsPerDay: 2 });
    const once = shown([at(12)]);
    expect(decide(cfg, once, at(12, 1), 0.99)).toEqual({ show: true });
    expect(decide(cfg, shown([at(12), at(12, 1)]), at(12, 2), 0)).toEqual({ show: false, reason: 'daily_limit' });
    expect(decide(cfg, EMPTY_STATE, at(23, 30), 0)).toEqual({ show: false, reason: 'quiet_hours' });
  });
});

describe('nextScheduledSlot', () => {
  it('spreads cards across the active part of the day', () => {
    // 16 active hours / 8 cards = one every 2 hours (longer than the 30-minute cooldown).
    const slot = nextScheduledSlot(config({ maxCardsPerDay: 8 }), shown([at(10)]), at(10, 1));
    expect(slot).toBe(at(12));
  });

  it('never schedules closer than the cooldown', () => {
    const slot = nextScheduledSlot(config({ maxCardsPerDay: 50, cooldownMinutes: 45 }), shown([at(10)]), at(10, 1));
    expect(slot).toBe(at(10, 45));
  });

  it('moves out of quiet hours to the next morning', () => {
    const slot = nextScheduledSlot(config({ maxCardsPerDay: 8 }), shown([at(22)]), at(22, 1));
    expect(slot).toBe(at(7, 0, 12));
  });

  it('waits for the next day once the cap is reached', () => {
    const cfg = config({ maxCardsPerDay: 2, cooldownMinutes: 30 });
    const slot = nextScheduledSlot(cfg, shown([at(9), at(15)]), at(15, 1));
    expect(slot).toBe(at(7, 0, 12));
  });

  it('skips work hours', () => {
    const cfg = config({ maxCardsPerDay: 16, workHours: { enabled: true, start: HM(9), end: HM(17), days: [3] } });
    expect(nextScheduledSlot(cfg, EMPTY_STATE, at(8, 30))).toBe(at(17));
  });

  it('returns null when disabled', () => {
    expect(nextScheduledSlot(config({ enabled: false }), EMPTY_STATE, at(12))).toBeNull();
  });
});
