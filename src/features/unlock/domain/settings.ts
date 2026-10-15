import { z } from 'zod';

import type { CardPolicyConfig } from './policy';

const minute = z.number().int().min(0).max(1439);
const weekday = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]);

export const CARD_TYPES = ['vocabulary', 'phrase', 'grammar'] as const;
export type CardType = (typeof CARD_TYPES)[number];

/**
 * - `unlock`: an opt-in background listener shows a card after some unlocks.
 * - `scheduled`: no listener; cards arrive at spread-out times. Works without a
 *   persistent notification.
 */
export const DELIVERY_MODES = ['unlock', 'scheduled'] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const unlockSettingsSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(DELIVERY_MODES),
  maxCardsPerDay: z.number().int().min(1).max(50),
  cooldownMinutes: z.number().int().min(0).max(240),
  quietHours: z.object({ enabled: z.boolean(), start: minute, end: minute }),
  workHours: z.object({ enabled: z.boolean(), start: minute, end: minute, days: z.array(weekday) }),
  frequency: z.enum(['low', 'normal', 'high']),
  everyUnlock: z.boolean(),
  cardTypes: z.array(z.enum(CARD_TYPES)).min(1),
});

export type UnlockSettings = z.infer<typeof unlockSettingsSchema>;

/** Off until the learner turns it on. Example defaults from the product brief. */
export const DEFAULT_UNLOCK_SETTINGS: UnlockSettings = {
  enabled: false,
  mode: 'unlock',
  maxCardsPerDay: 10,
  cooldownMinutes: 30,
  quietHours: { enabled: true, start: 23 * 60, end: 7 * 60 },
  workHours: { enabled: false, start: 9 * 60, end: 17 * 60, days: [1, 2, 3, 4, 5] },
  frequency: 'normal',
  everyUnlock: false,
  cardTypes: ['vocabulary', 'phrase'],
};

export const MAX_CARDS_RANGE = { min: 1, max: 50 } as const;
export const COOLDOWN_RANGE = { min: 0, max: 240 } as const;

export function toPolicyConfig(s: UnlockSettings): CardPolicyConfig {
  return {
    enabled: s.enabled,
    maxCardsPerDay: s.maxCardsPerDay,
    cooldownMinutes: s.cooldownMinutes,
    quietHours: s.quietHours,
    workHours: s.workHours,
    frequency: s.frequency,
    everyUnlock: s.everyUnlock,
  };
}

export function formatMinuteOfDay(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
