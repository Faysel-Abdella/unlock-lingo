import { createRepositories } from '@/repositories';
import type { RecognitionOutcome, SpeechRecognitionProvider } from '@/services/audio/recognition';
import { runMigrations } from '@/services/database/migrations';
import { seedContent } from '@/services/database/seed';
import { createNodeDatabase } from '@/services/database/testing/nodeDatabase';

import { attemptPronunciation } from './pronunciationService';

const provider = (outcome: RecognitionOutcome): SpeechRecognitionProvider => ({
  isAvailable: () => true,
  requestPermission: async () => true,
  recognize: async () => outcome,
  cancel: () => undefined,
});

describe('attemptPronunciation', () => {
  it('scores and stores heard attempts but not silence', async () => {
    const db = createNodeDatabase();
    await runMigrations(db);
    await seedContent(db, 0);
    const repos = createRepositories(db);
    const target = { itemId: 'en-vocab-vague', expected: 'vague', language: 'en' as const };

    const heard = await attemptPronunciation(repos, provider({ kind: 'heard', hypotheses: [{ transcript: 'Vague.', confidence: 0.9 }] }), target, () => 5);
    expect(heard.score).toMatchObject({ verdict: 'clear', heard: 'Vague.' });

    const silent = await attemptPronunciation(repos, provider({ kind: 'silence' }), target, () => 6);
    expect(silent.score).toBeNull();

    expect(await repos.pronunciation.stats('en', 0)).toMatchObject({ attempts: 1, clear: 1 });
    db.close();
  });
});
