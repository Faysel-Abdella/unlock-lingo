import { MIGRATIONS, getSchemaVersion, runMigrations } from './migrations';
import { CONTENT_VERSION, SEED_CONTENT, seedContent, validateSeed } from './seed';
import { createNodeDatabase } from './testing/nodeDatabase';

const NOW = Date.UTC(2026, 0, 1);

describe('migrations', () => {
  it('applies every migration once and records the schema version', async () => {
    const db = createNodeDatabase();
    expect(await runMigrations(db)).toEqual(MIGRATIONS.map((m) => m.version));
    expect(await getSchemaVersion(db)).toBe(MIGRATIONS[MIGRATIONS.length - 1]!.version);
    expect(await runMigrations(db)).toEqual([]);
    db.close();
  });

  it('rolls back a failing migration and leaves the version unchanged', async () => {
    const db = createNodeDatabase();
    await runMigrations(db);
    const before = await getSchemaVersion(db);
    const broken = { version: before + 1, name: 'broken', sql: 'CREATE TABLE ok_table (id INTEGER); SELECT * FROM missing_table;' };
    await expect(runMigrations(db, [...MIGRATIONS, broken])).rejects.toThrow();
    expect(await getSchemaVersion(db)).toBe(before);
    expect(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'ok_table'", [])).toBeNull();
    db.close();
  });
});

describe('seed content', () => {
  it('meets the content plan: ~100 vocabulary, 30 grammar, 20 phrases, mostly B1–C1', () => {
    const content = validateSeed(SEED_CONTENT);
    expect(content.vocabulary.length).toBeGreaterThanOrEqual(100);
    expect(content.grammar).toHaveLength(30);
    expect(content.phrases).toHaveLength(20);
    const all = [...content.vocabulary, ...content.grammar, ...content.phrases];
    const levels = new Set(all.map((i) => i.cefrLevel));
    expect([...levels].sort()).toEqual(['B1', 'B2', 'C1']);
  });

  it('seeds once per content version and is idempotent', async () => {
    const db = createNodeDatabase();
    await runMigrations(db);
    expect(await seedContent(db, NOW)).toBe(true);
    expect(await seedContent(db, NOW)).toBe(false);
    const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM learning_items', []);
    expect(count?.n).toBe(SEED_CONTENT.vocabulary.length + SEED_CONTENT.grammar.length + SEED_CONTENT.phrases.length);
    const meta = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_meta WHERE key = 'content_version'", []);
    expect(meta?.value).toBe(String(CONTENT_VERSION));
    db.close();
  });

  it('keeps learner progress when content is re-seeded', async () => {
    const db = createNodeDatabase();
    await runMigrations(db);
    await seedContent(db, NOW);
    await db.runAsync(
      `INSERT INTO learning_progress (item_id, status, reps, created_at, updated_at) VALUES ('en-vocab-resilient', 'reviewing', 3, ?, ?)`,
      [NOW, NOW],
    );
    await db.runAsync("UPDATE app_meta SET value = '0' WHERE key = 'content_version'", []);
    await seedContent(db, NOW + 1);
    const row = await db.getFirstAsync<{ reps: number }>("SELECT reps FROM learning_progress WHERE item_id = 'en-vocab-resilient'", []);
    expect(row?.reps).toBe(3);
    db.close();
  });
});
