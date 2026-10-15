import { z } from 'zod';

import { cefrLevelSchema, languageCodeSchema } from '@/types/language';

const base = {
  id: z.string().regex(/^[a-z]{2}-(vocab|grammar|phrase)-[a-z0-9-]+$/),
  language: languageCodeSchema,
  cefrLevel: cefrLevelSchema,
  difficulty: z.number().int().min(1).max(10),
  tags: z.array(z.string()),
};

export const seedVocabularySchema = z
  .object({
    ...base,
    word: z.string().min(1),
    pronunciation: z.string().regex(/^\/.+\/$/),
    partOfSpeech: z.enum(['noun', 'verb', 'adjective', 'adverb']),
    definition: z.string().min(5),
    example: z.string().min(5),
    translations: z.partialRecord(languageCodeSchema, z.string().min(1)),
    synonyms: z.array(z.string()),
    antonyms: z.array(z.string()),
  })
  .refine((v) => new RegExp(`\\b${v.word}\\b`, 'i').test(v.example), {
    message: 'example must contain the word itself so it can be used for fill-in-the-blank',
  });

export const seedGrammarSchema = z
  .object({
    ...base,
    rule: z.string().min(3),
    explanation: z.string().min(10),
    example: z.string().min(5),
    question: z.string().includes('___'),
    options: z.array(z.string().min(1)).min(3).max(5),
    correctAnswer: z.string().min(1),
    answerExplanation: z.string().min(5),
  })
  .refine((g) => g.options.includes(g.correctAnswer), { message: 'correctAnswer must be one of the options' })
  .refine((g) => new Set(g.options).size === g.options.length, { message: 'options must be unique' });

export const seedPhraseSchema = z.object({
  ...base,
  phrase: z.string().min(2),
  meaning: z.string().min(5),
  example: z.string().min(5),
  usageNote: z.string().nullable(),
});

export type SeedVocabulary = z.infer<typeof seedVocabularySchema>;
export type SeedGrammar = z.infer<typeof seedGrammarSchema>;
export type SeedPhrase = z.infer<typeof seedPhraseSchema>;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const LEVEL_DIFFICULTY = { A1: 1, A2: 2, B1: 4, B2: 6, C1: 8, C2: 9 } as const;

type Level = keyof typeof LEVEL_DIFFICULTY;
type PartOfSpeech = SeedVocabulary['partOfSpeech'];

interface VocabExtras {
  syn?: string[];
  ant?: string[];
  es: string;
  fr: string;
  tags?: string[];
}

/** Compact authoring helper for English vocabulary seed entries. */
export function vocab(
  level: Level,
  word: string,
  pronunciation: string,
  partOfSpeech: PartOfSpeech,
  definition: string,
  example: string,
  extras: VocabExtras,
): SeedVocabulary {
  return {
    id: `en-vocab-${slugify(word)}`,
    language: 'en',
    cefrLevel: level,
    difficulty: LEVEL_DIFFICULTY[level],
    tags: extras.tags ?? ['general'],
    word,
    pronunciation,
    partOfSpeech,
    definition,
    example,
    translations: { es: extras.es, fr: extras.fr },
    synonyms: extras.syn ?? [],
    antonyms: extras.ant ?? [],
  };
}

interface GrammarFields {
  rule: string;
  explanation: string;
  example: string;
  question: string;
  options: string[];
  answer: string;
  why: string;
  tags?: string[];
}

export function grammar(level: Level, key: string, f: GrammarFields): SeedGrammar {
  return {
    id: `en-grammar-${key}`,
    language: 'en',
    cefrLevel: level,
    difficulty: LEVEL_DIFFICULTY[level],
    tags: f.tags ?? ['general'],
    rule: f.rule,
    explanation: f.explanation,
    example: f.example,
    question: f.question,
    options: f.options,
    correctAnswer: f.answer,
    answerExplanation: f.why,
  };
}

export function phrase(
  level: Level,
  text: string,
  meaning: string,
  example: string,
  opts: { note?: string; tags?: string[] } = {},
): SeedPhrase {
  return {
    id: `en-phrase-${slugify(text)}`,
    language: 'en',
    cefrLevel: level,
    difficulty: LEVEL_DIFFICULTY[level],
    tags: opts.tags ?? ['general'],
    phrase: text,
    meaning,
    example,
    usageNote: opts.note ?? null,
  };
}
