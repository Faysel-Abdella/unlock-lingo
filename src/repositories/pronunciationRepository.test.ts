import { runMigrations } from '@/services/database/migrations';
import { seedContent } from '@/services/database/seed';
import { createNodeDatabase } from '@/services/database/testing/nodeDatabase';

import { createRepositories } from './index';

describe('pronunciation repository', () => {
  it('summarises attempts and lists items whose latest attempt was not clear', async () => {
    const db = createNodeDatabase();
    await runMigrations(db);
    await seedContent(db, 0);
    const repos = createRepositories(db);
    const attempt = (itemId: string, expected: string, verdict: 'clear' | 'close' | 'unclear', at: number) =>
      repos.pronunciation.record({ itemId, expected, heard: verdict === 'clear' ? expected : 'x', similarity: verdict === 'clear' ? 1 : 0.5, verdict, attemptedAt: at });

    await attempt('en-vocab-vague', 'vague', 'unclear', 10);
    await attempt('en-vocab-vague', 'vague', 'clear', 20);
    await attempt('en-vocab-candid', 'candid', 'close', 30);
    await attempt('en-vocab-ambiguous', 'ambiguous', 'unclear', 40);

    const stats = await repos.pronunciation.stats('en', 0);
    expect(stats).toEqual({
      attempts: 4,
      clear: 1,
      needsPractice: [
        { itemId: 'en-vocab-ambiguous', expected: 'ambiguous' },
        { itemId: 'en-vocab-candid', expected: 'candid' },
      ],
    });
    expect((await repos.pronunciation.stats('en', 35)).attempts).toBe(1);

    await repos.profile.resetProgress();
    expect((await repos.pronunciation.stats('en', 0)).attempts).toBe(0);
    db.close();
  });
});
