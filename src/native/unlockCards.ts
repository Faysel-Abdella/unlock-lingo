import { requireOptionalNativeModule } from 'expo';
import { z } from 'zod';

import type { CardPolicyConfig } from '@/features/unlock/domain/policy';
import type { DeliveryMode } from '@/features/unlock/domain/settings';

/**
 * Typed bridge to the local `unlock-cards` Expo module (modules/unlock-cards, Kotlin).
 * Every call is a no-op when the native module is unavailable (iOS, tests).
 */
export interface NativeCard {
  itemId: string;
  /** "flash": self-graded from the notification. "quiz": opens the app to answer. */
  kind: 'flash' | 'quiz';
  title: string;
  subtitle: string | null;
  body: string;
  example: string | null;
}

export interface NativeCardsConfig {
  mode: DeliveryMode;
  policy: CardPolicyConfig;
}

interface UnlockCardsNativeModule {
  configure(configJson: string, deckJson: string): Promise<void>;
  consumeEvents(): unknown;
  getStatus(): unknown;
  preview(cardJson: string): Promise<void>;
}

const native = requireOptionalNativeModule<UnlockCardsNativeModule>('UnlockCards');

export const cardEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('shown'), itemId: z.string(), at: z.number() }),
  z.object({ type: z.literal('answered'), itemId: z.string(), at: z.number(), knewIt: z.boolean() }),
  z.object({ type: z.literal('saved'), itemId: z.string(), at: z.number() }),
  z.object({ type: z.literal('dismissed'), itemId: z.string(), at: z.number() }),
]);
export type CardEvent = z.infer<typeof cardEventSchema>;

const statusSchema = z.object({
  listenerRunning: z.boolean(),
  notificationsEnabled: z.boolean(),
  deckSize: z.number(),
  shownToday: z.number(),
});
export type UnlockCardsStatus = z.infer<typeof statusSchema>;

export const unlockCards = {
  isAvailable: native !== null,

  async configure(config: NativeCardsConfig, deck: NativeCard[]): Promise<void> {
    await native?.configure(JSON.stringify(config), JSON.stringify(deck));
  },

  /** Returns and clears the native event log. Malformed entries are dropped. */
  consumeEvents(): CardEvent[] {
    const raw = native?.consumeEvents();
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((e: unknown) => {
      const parsed = cardEventSchema.safeParse(e);
      return parsed.success ? [parsed.data] : [];
    });
  },

  getStatus(): UnlockCardsStatus | null {
    if (!native) return null;
    const parsed = statusSchema.safeParse(native.getStatus());
    return parsed.success ? parsed.data : null;
  },

  async preview(card: NativeCard): Promise<void> {
    await native?.preview(JSON.stringify(card));
  },
};
