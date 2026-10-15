import { nextReminderSlot } from './reminder';

// Jest pins TZ=Europe/Berlin. 2026-03-11 is a Wednesday; Sunday is review day 0.
const at = (month: number, day: number, h = 9, m = 0) => new Date(2026, month - 1, day, h, m).getTime();
const time = { hour: 18, minute: 30 };

describe('nextReminderSlot', () => {
  it('targets the coming review day at the reminder time', () => {
    const slot = nextReminderSlot(at(3, 11), 0, time, null);
    expect(slot.week).toEqual({ start: '2026-03-09', end: '2026-03-15' });
    expect(slot.at).toBe(at(3, 15, 18, 30));
  });

  it('uses today before the reminder time and next week after it', () => {
    expect(nextReminderSlot(at(3, 15, 10), 0, time, null).week.end).toBe('2026-03-15');
    expect(nextReminderSlot(at(3, 15, 19), 0, time, null).week.end).toBe('2026-03-22');
  });

  it('skips a week whose review is already completed', () => {
    expect(nextReminderSlot(at(3, 15, 10), 0, time, '2026-03-15').week.end).toBe('2026-03-22');
    expect(nextReminderSlot(at(3, 11), 0, time, '2026-03-08').week.end).toBe('2026-03-15');
  });

  it('keeps the wall-clock time across the spring DST change', () => {
    // Europe/Berlin switches to summer time on Sunday 2026-03-29.
    const slot = nextReminderSlot(at(3, 25), 0, time, null);
    expect(new Date(slot.at).getHours()).toBe(18);
    expect(new Date(slot.at).getMinutes()).toBe(30);
  });
});
