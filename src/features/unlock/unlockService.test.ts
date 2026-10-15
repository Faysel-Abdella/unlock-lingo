import { DEFAULT_SETTINGS, type AppSettings, type UserProfile } from '@/features/settings/schema';
import type { CardEvent, NativeCard, NativeCardsConfig } from '@/native/unlockCards';
import { createRepositories } from '@/repositories';
import { runMigrations } from '@/services/database/migrations';
import { seedContent } from '@/services/database/seed';
import { createNodeDatabase } from '@/services/database/testing/nodeDatabase';
import { toDateKey } from '@/utils/date';

import { DEFAULT_UNLOCK_SETTINGS } from './domain/settings';
import { DECK_SIZE, type UnlockBridge, buildDeck, importCardEvents, syncUnlockCards, toCard } from './unlockService';

const NOW = new Date(2026, 2, 11, 12, 0).getTime();
const DAY = 86_400_000;
const profile: UserProfile = {
  targetLanguage: 'en',
  nativeLanguage: null,
  currentLevel: 'B2',
  targetLevel: 'C1',
  interests: [],
  onboardedAt: NOW,
};
const settings = (unlock: Partial<AppSettings['unlock']> = {}): AppSettings => ({
  ...DEFAULT_SETTINGS,
  unlock: { ...DEFAULT_UNLOCK_SETTINGS, enabled: true, ...unlock },
});

function fakeBridge(events: CardEvent[] = []) {
  const bridge: UnlockBridge & { config: NativeCardsConfig | null; deck: NativeCard[] } = {
    config: null,
    deck: [],
    async configure(config, deck) {
      bridge.config = config;
      bridge.deck = deck;
    },
    consumeEvents() {
      const out = events;
      events = [];
      return out;
    },
  };
  return bridge;
}

async function setup() {
  const db = createNodeDatabase();
  await runMigrations(db);
  await seedContent(db, NOW);
  return { db, repos: createRepositories(db) };
}

describe('cards', () => {
  it('formats vocabulary as a self-graded card and grammar as a quiz card', async () => {
    const { db, repos } = await setup();
    const [word, rule] = await repos.content.getItems(['en-vocab-resilient', 'en-grammar-since-for']);
    expect(toCard(word!)).toMatchObject({ kind: 'flash', title: 'resilient', subtitle: '/rɪˈzɪliənt/ · adjective' });
    expect(toCard(rule!)).toMatchObject({ kind: 'quiz', body: 'We have worked together ___ 2022.' });
    db.close();
  });

  it('builds a deck with due reviews first and only the chosen card types', async () => {
    const { db, repos } = await setup();
    await repos.progress.recordReview({
      itemId: 'en-vocab-candid',
      itemType: 'vocabulary',
      exerciseType: 'meaning',
      outcome: { kind: 'quiz', correct: true, responseMs: 2000 },
      context: 'session',
      now: NOW - 5 * DAY,
    });
    const deck = await buildDeck(repos, profile, settings({ cardTypes: ['vocabulary'] }), NOW);
    expect(deck[0]?.itemId).toBe('en-vocab-candid');
    expect(deck.length).toBeLessThanOrEqual(DECK_SIZE);
    expect(deck.every((c) => c.itemId.startsWith('en-vocab-'))).toBe(true);
    db.close();
  });
});

describe('syncUnlockCards', () => {
  it('pushes the policy and a deck when on, and an empty deck with enabled=false when off', async () => {
    const { db, repos } = await setup();
    const bridge = fakeBridge();
    await syncUnlockCards(repos, bridge, profile, settings({ mode: 'scheduled', maxCardsPerDay: 6 }), NOW);
    expect(bridge.config).toMatchObject({ mode: 'scheduled', policy: { enabled: true, maxCardsPerDay: 6 } });
    expect(bridge.deck.length).toBeGreaterThan(0);

    await syncUnlockCards(repos, bridge, profile, settings({ enabled: false }), NOW);
    expect(bridge.config?.policy.enabled).toBe(false);
    expect(bridge.deck).toEqual([]);
    db.close();
  });
});

describe('importCardEvents', () => {
  it('counts shown cards, records answers as unlock reviews, saves words and ignores dismissals', async () => {
    const { db, repos } = await setup();
    await importCardEvents(repos, profile, [
      { type: 'shown', itemId: 'en-vocab-vague', at: NOW },
      { type: 'answered', itemId: 'en-vocab-vague', at: NOW + 5000, knewIt: true },
      { type: 'shown', itemId: 'en-vocab-tedious', at: NOW + 3_600_000 },
      { type: 'saved', itemId: 'en-vocab-tedious', at: NOW + 3_605_000 },
      { type: 'shown', itemId: 'en-vocab-crucial', at: NOW + 7_200_000 },
      { type: 'dismissed', itemId: 'en-vocab-crucial', at: NOW + 7_201_000 },
      { type: 'answered', itemId: 'en-vocab-does-not-exist', at: NOW, knewIt: true },
    ]);
    expect(await repos.activity.getDay(toDateKey(NOW))).toMatchObject({ unlockCardsShown: 3, interactions: 1 });
    expect(await repos.progress.getProgress('en-vocab-vague')).toMatchObject({ reps: 1 });
    expect(await repos.progress.getProgress('en-vocab-crucial')).toBeNull();
    expect((await repos.personal.list()).map((w) => w.word)).toEqual(['tedious']);
    db.close();
  });
});
