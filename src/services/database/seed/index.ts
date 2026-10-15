import type { Database } from '../types';
import { GRAMMAR_EN } from './grammar.en';
import { PHRASES_EN } from './phrases.en';
import {
  type SeedGrammar,
  type SeedPhrase,
  type SeedVocabulary,
  seedGrammarSchema,
  seedPhraseSchema,
  seedVocabularySchema,
} from './schema';
import { VOCABULARY_EN } from './vocabulary.en';

/** Bump when seed content changes so existing installs receive the update. */
export const CONTENT_VERSION = 1;

export interface SeedBundle {
  vocabulary: SeedVocabulary[];
  grammar: SeedGrammar[];
  phrases: SeedPhrase[];
}

export const SEED_CONTENT: SeedBundle = {
  vocabulary: VOCABULARY_EN,
  grammar: GRAMMAR_EN,
  phrases: PHRASES_EN,
};

/** Validates seed content and ensures IDs are unique. Throws on the first problem. */
export function validateSeed(bundle: SeedBundle): SeedBundle {
  const vocabulary = bundle.vocabulary.map((v) => seedVocabularySchema.parse(v));
  const grammar = bundle.grammar.map((g) => seedGrammarSchema.parse(g));
  const phrases = bundle.phrases.map((p) => seedPhraseSchema.parse(p));
  const ids = [...vocabulary, ...grammar, ...phrases].map((i) => i.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) throw new Error(`Duplicate seed ids: ${duplicates.join(', ')}`);
  return { vocabulary, grammar, phrases };
}

const UPSERT_ITEM = `
INSERT INTO learning_items (id, type, language, cefr_level, difficulty, tags, source, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, 'seed', ?, ?)
ON CONFLICT (id) DO UPDATE SET
  type = excluded.type, language = excluded.language, cefr_level = excluded.cefr_level,
  difficulty = excluded.difficulty, tags = excluded.tags, updated_at = excluded.updated_at`;

async function upsertItem(
  db: Database,
  item: { id: string; language: string; cefrLevel: string; difficulty: number; tags: string[] },
  type: 'vocabulary' | 'grammar' | 'phrase',
  now: number,
): Promise<void> {
  await db.runAsync(UPSERT_ITEM, [
    item.id,
    type,
    item.language,
    item.cefrLevel,
    item.difficulty,
    JSON.stringify(item.tags),
    now,
    now,
  ]);
}

/**
 * Inserts or updates bundled content when the stored content version is older
 * than `CONTENT_VERSION`. Upserts by stable ID, so learner progress is never lost.
 * Returns true when content was written.
 */
export async function seedContent(db: Database, now: number, bundle: SeedBundle = SEED_CONTENT): Promise<boolean> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_meta WHERE key = 'content_version'", []);
  if (Number(row?.value ?? 0) >= CONTENT_VERSION) return false;

  const content = validateSeed(bundle);
  await db.withTransactionAsync(async () => {
    for (const v of content.vocabulary) {
      await upsertItem(db, v, 'vocabulary', now);
      await db.runAsync(
        `INSERT INTO vocabulary_items
           (item_id, word, pronunciation, part_of_speech, definition, example, translations, synonyms, antonyms, audio_uri)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
         ON CONFLICT (item_id) DO UPDATE SET
           word = excluded.word, pronunciation = excluded.pronunciation, part_of_speech = excluded.part_of_speech,
           definition = excluded.definition, example = excluded.example, translations = excluded.translations,
           synonyms = excluded.synonyms, antonyms = excluded.antonyms`,
        [
          v.id,
          v.word,
          v.pronunciation,
          v.partOfSpeech,
          v.definition,
          v.example,
          JSON.stringify(v.translations),
          JSON.stringify(v.synonyms),
          JSON.stringify(v.antonyms),
        ],
      );
    }
    for (const g of content.grammar) {
      await upsertItem(db, g, 'grammar', now);
      await db.runAsync(
        `INSERT INTO grammar_items
           (item_id, rule, explanation, example, question, options, correct_answer, answer_explanation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (item_id) DO UPDATE SET
           rule = excluded.rule, explanation = excluded.explanation, example = excluded.example,
           question = excluded.question, options = excluded.options, correct_answer = excluded.correct_answer,
           answer_explanation = excluded.answer_explanation`,
        [g.id, g.rule, g.explanation, g.example, g.question, JSON.stringify(g.options), g.correctAnswer, g.answerExplanation],
      );
    }
    for (const p of content.phrases) {
      await upsertItem(db, p, 'phrase', now);
      await db.runAsync(
        `INSERT INTO phrase_items (item_id, phrase, meaning, example, usage_note)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (item_id) DO UPDATE SET
           phrase = excluded.phrase, meaning = excluded.meaning, example = excluded.example,
           usage_note = excluded.usage_note`,
        [p.id, p.phrase, p.meaning, p.example, p.usageNote],
      );
    }
    await db.runAsync(
      `INSERT INTO app_meta (key, value) VALUES ('content_version', ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      [String(CONTENT_VERSION)],
    );
  });
  return true;
}
