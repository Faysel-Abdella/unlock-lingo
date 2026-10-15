import { buildQueue } from '@/features/learning/domain/queue';
import { getLevelPolicy } from '@/features/learning/learningService';
import type { AppSettings, UserProfile } from '@/features/settings/schema';
import type { CardEvent, NativeCard, NativeCardsConfig } from '@/native/unlockCards';
import type { Repositories } from '@/repositories';
import type { LearningItem } from '@/types/learning';
import { toDateKey } from '@/utils/date';

import { toPolicyConfig } from './domain/settings';

/** The parts of the native bridge this service needs; injected for tests. */
export interface UnlockBridge {
  configure(config: NativeCardsConfig, deck: NativeCard[]): Promise<void>;
  consumeEvents(): CardEvent[];
}

/** Cards prepared ahead so the native side can show them without JS. */
export const DECK_SIZE = 30;

/** Formats an item for a notification card. Returns null when there is nothing useful to show. */
export function toCard(item: LearningItem): NativeCard | null {
  switch (item.type) {
    case 'vocabulary': {
      const subtitle = [item.pronunciation, item.partOfSpeech].filter(Boolean).join(' · ') || null;
      return {
        itemId: item.id,
        kind: 'flash',
        title: item.word,
        subtitle,
        body: item.definition ?? 'Do you remember what this means?',
        example: item.example,
      };
    }
    case 'phrase':
      return { itemId: item.id, kind: 'flash', title: item.phrase, subtitle: null, body: item.meaning, example: item.example };
    case 'grammar':
      return { itemId: item.id, kind: 'quiz', title: item.rule, subtitle: null, body: item.question, example: null };
  }
}

/**
 * Builds the deck with the same priorities as a session: due reviews, then
 * difficult and failed items, then a rationed number of new items.
 */
export async function buildDeck(
  repos: Repositories,
  profile: UserProfile,
  settings: AppSettings,
  now: number,
): Promise<NativeCard[]> {
  const language = profile.targetLanguage;
  const types = settings.unlock.cardTypes;
  const [candidates, day, policy] = await Promise.all([
    repos.progress.getQueueCandidates(language),
    repos.activity.getDay(toDateKey(now)),
    getLevelPolicy(repos, profile, now),
  ]);
  const queue = buildQueue(
    candidates.filter((c) => (types as readonly string[]).includes(c.type)),
    {
      now,
      size: DECK_SIZE,
      newItemsRemainingToday: Math.max(0, settings.newItemsPerDay - day.newItems),
      allowedLevels: policy.allowedLevels,
      interests: profile.interests,
    },
  );
  const items = await repos.content.getItems(queue.map((e) => e.itemId));
  return items.flatMap((item) => toCard(item) ?? []);
}

/** Imports native card outcomes into SQLite. */
export async function importCardEvents(repos: Repositories, profile: UserProfile | null, events: readonly CardEvent[]): Promise<void> {
  for (const event of events) {
    switch (event.type) {
      case 'shown':
        await repos.activity.increment(toDateKey(event.at), { unlockCardsShown: 1 }, event.at);
        break;
      case 'answered': {
        const item = await repos.content.getItem(event.itemId);
        if (!item) break; // removed since the card was prepared
        await repos.progress.recordReview({
          itemId: item.id,
          itemType: item.type,
          exerciseType: 'intro',
          outcome: { kind: 'self', knewIt: event.knewIt },
          context: 'unlock',
          now: event.at,
        });
        break;
      }
      case 'saved': {
        const item = await repos.content.getItem(event.itemId);
        if (item?.type === 'vocabulary' && profile) {
          await repos.personal.add(
            { word: item.word, language: profile.targetLanguage, defaultLevel: profile.currentLevel, source: 'other' },
            event.at,
          );
        }
        break;
      }
      case 'dismissed':
        // Dismissing is not an answer: progress stays unchanged.
        break;
    }
  }
}

/**
 * Imports outcomes, rebuilds the deck from the current learning state and pushes
 * configuration to the native side, which starts or stops delivery to match.
 */
export async function syncUnlockCards(
  repos: Repositories,
  bridge: UnlockBridge,
  profile: UserProfile | null,
  settings: AppSettings,
  now: number,
): Promise<void> {
  await importCardEvents(repos, profile, bridge.consumeEvents());
  const enabled = settings.unlock.enabled && profile !== null;
  const deck = enabled && profile ? await buildDeck(repos, profile, settings, now) : [];
  await bridge.configure(
    { mode: settings.unlock.mode, policy: { ...toPolicyConfig(settings.unlock), enabled } },
    deck,
  );
}
