import { LANGUAGES, type LanguageCode } from '@/types/language';
import type {
  ExerciseType,
  GrammarItem,
  LearningItem,
  PhraseItem,
  VocabularyItem,
} from '@/types/learning';
import { type Rng, pickOne, shuffle } from '@/utils/random';

export interface ChoiceQuestion {
  kind: 'choice';
  itemId: string;
  exerciseType: ExerciseType;
  /** Instruction, e.g. "Choose the word that fits". */
  prompt: string;
  /** Large focal text (a word or sentence). Null for audio-only questions. */
  subject: string | null;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  /** Text to speak for listening questions. */
  audioText: string | null;
}

/** A card shown for exposure or self-grading rather than a scored quiz. */
export interface CardQuestion {
  kind: 'card';
  itemId: string;
  exerciseType: 'intro';
  item: LearningItem;
}

export type Question = ChoiceQuestion | CardQuestion;

export interface ExerciseContext {
  /** Other items used as distractor sources. May include the item itself. */
  pool: readonly LearningItem[];
  nativeLanguage: LanguageCode | null;
  rng: Rng;
  /** Restrict to these exercise types (e.g. the alarm challenge configuration). */
  allowedTypes?: readonly ExerciseType[];
  /** Exercise type used last time for this item, to add variety. */
  avoidType?: ExerciseType;
}

const OPTION_COUNT = 4;
const MIN_OPTIONS = 3;
const BLANK = '_____';

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Picks up to `count` distinct distractors, excluding the answer and anything in `exclude`. */
export function pickDistractors(
  candidates: readonly string[],
  answer: string,
  count: number,
  rng: Rng,
  exclude: readonly string[] = [],
): string[] {
  const banned = new Set([normalize(answer), ...exclude.map(normalize)]);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const c of candidates) {
    const key = normalize(c);
    if (!key || banned.has(key) || seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  return shuffle(unique, rng).slice(0, count);
}

function buildChoice(
  base: Omit<ChoiceQuestion, 'kind' | 'options' | 'correctIndex'>,
  answer: string,
  distractors: string[],
  rng: Rng,
): ChoiceQuestion | null {
  if (distractors.length + 1 < MIN_OPTIONS) return null;
  const options = shuffle([answer, ...distractors], rng);
  return { kind: 'choice', ...base, options, correctIndex: options.indexOf(answer) };
}

/** Finds the word as a whole word in the sentence and blanks it out. */
export function blankOut(sentence: string, word: string): string | null {
  const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');
  if (!pattern.test(sentence)) return null;
  return sentence.replace(pattern, BLANK);
}

function vocabularyPool(ctx: ExerciseContext, item: VocabularyItem): VocabularyItem[] {
  const related = new Set([...item.synonyms, ...item.antonyms].map(normalize));
  return ctx.pool.filter(
    (p): p is VocabularyItem =>
      p.type === 'vocabulary' &&
      p.id !== item.id &&
      normalize(p.word) !== normalize(item.word) &&
      !related.has(normalize(p.word)),
  );
}

/** Prefers distractors with the same part of speech so options are grammatically plausible. */
function samePartOfSpeechFirst(item: VocabularyItem, pool: VocabularyItem[]): VocabularyItem[] {
  const same = pool.filter((p) => p.partOfSpeech && p.partOfSpeech === item.partOfSpeech);
  return same.length >= OPTION_COUNT - 1 ? same : pool;
}

type VocabBuilder = (item: VocabularyItem, ctx: ExerciseContext) => ChoiceQuestion | null;

const vocabularyBuilders: Partial<Record<ExerciseType, VocabBuilder>> = {
  meaning(item, ctx) {
    if (!item.definition) return null;
    const pool = samePartOfSpeechFirst(item, vocabularyPool(ctx, item));
    const distractors = pickDistractors(
      pool.map((p) => p.definition ?? ''),
      item.definition,
      OPTION_COUNT - 1,
      ctx.rng,
    );
    return buildChoice(
      {
        itemId: item.id,
        exerciseType: 'meaning',
        prompt: 'What does this word mean?',
        subject: item.word,
        explanation: item.example,
        audioText: null,
      },
      item.definition,
      distractors,
      ctx.rng,
    );
  },

  choose_word(item, ctx) {
    if (!item.definition) return null;
    const pool = samePartOfSpeechFirst(item, vocabularyPool(ctx, item));
    const distractors = pickDistractors(pool.map((p) => p.word), item.word, OPTION_COUNT - 1, ctx.rng);
    return buildChoice(
      {
        itemId: item.id,
        exerciseType: 'choose_word',
        prompt: 'Which word matches this meaning?',
        subject: item.definition,
        explanation: item.example,
        audioText: null,
      },
      item.word,
      distractors,
      ctx.rng,
    );
  },

  fill_blank(item, ctx) {
    if (!item.example) return null;
    const sentence = blankOut(item.example, item.word);
    if (!sentence) return null;
    const pool = samePartOfSpeechFirst(item, vocabularyPool(ctx, item));
    const distractors = pickDistractors(pool.map((p) => p.word), item.word, OPTION_COUNT - 1, ctx.rng);
    return buildChoice(
      {
        itemId: item.id,
        exerciseType: 'fill_blank',
        prompt: 'Fill in the blank',
        subject: sentence,
        explanation: item.definition ? `${item.word}: ${item.definition}` : null,
        audioText: null,
      },
      item.word,
      distractors,
      ctx.rng,
    );
  },

  synonym(item, ctx) {
    const answer = pickOne(item.synonyms, ctx.rng);
    if (!answer) return null;
    const pool = samePartOfSpeechFirst(item, vocabularyPool(ctx, item));
    const distractors = pickDistractors(pool.map((p) => p.word), answer, OPTION_COUNT - 1, ctx.rng, [
      item.word,
      ...item.synonyms,
    ]);
    return buildChoice(
      {
        itemId: item.id,
        exerciseType: 'synonym',
        prompt: 'Which word is closest in meaning?',
        subject: item.word,
        explanation: `Synonyms of ${item.word}: ${item.synonyms.join(', ')}`,
        audioText: null,
      },
      answer,
      distractors,
      ctx.rng,
    );
  },

  antonym(item, ctx) {
    const answer = pickOne(item.antonyms, ctx.rng);
    if (!answer) return null;
    const pool = samePartOfSpeechFirst(item, vocabularyPool(ctx, item));
    const distractors = pickDistractors(pool.map((p) => p.word), answer, OPTION_COUNT - 1, ctx.rng, [
      item.word,
      ...item.antonyms,
      ...item.synonyms,
    ]);
    return buildChoice(
      {
        itemId: item.id,
        exerciseType: 'antonym',
        prompt: 'Which word means the opposite?',
        subject: item.word,
        explanation: `Opposites of ${item.word}: ${item.antonyms.join(', ')}`,
        audioText: null,
      },
      answer,
      distractors,
      ctx.rng,
    );
  },

  translate(item, ctx) {
    const native = ctx.nativeLanguage;
    if (!native || native === item.language) return null;
    const answer = item.translations[native];
    if (!answer) return null;
    const pool = vocabularyPool(ctx, item);
    const distractors = pickDistractors(
      pool.map((p) => p.translations[native] ?? ''),
      answer,
      OPTION_COUNT - 1,
      ctx.rng,
    );
    return buildChoice(
      {
        itemId: item.id,
        exerciseType: 'translate',
        prompt: `Translate into ${LANGUAGES[native].name}`,
        subject: item.word,
        explanation: item.definition,
        audioText: null,
      },
      answer,
      distractors,
      ctx.rng,
    );
  },

  listening(item, ctx) {
    const pool = vocabularyPool(ctx, item);
    // Words starting with the same letter make listening meaningfully harder.
    const initial = normalize(item.word).charAt(0);
    const similar = pool.filter((p) => normalize(p.word).charAt(0) === initial);
    const source = similar.length >= OPTION_COUNT - 1 ? similar : pool;
    const distractors = pickDistractors(source.map((p) => p.word), item.word, OPTION_COUNT - 1, ctx.rng);
    return buildChoice(
      {
        itemId: item.id,
        exerciseType: 'listening',
        prompt: 'Listen and choose the word you hear',
        subject: null,
        explanation: item.definition ? `${item.word}: ${item.definition}` : null,
        audioText: item.word,
      },
      item.word,
      distractors,
      ctx.rng,
    );
  },
};

function grammarQuestion(item: GrammarItem, ctx: ExerciseContext): ChoiceQuestion | null {
  const distractors = item.options.filter((o) => normalize(o) !== normalize(item.correctAnswer));
  return buildChoice(
    {
      itemId: item.id,
      exerciseType: 'grammar_choice',
      prompt: item.rule,
      subject: item.question,
      explanation: item.answerExplanation,
      audioText: null,
    },
    item.correctAnswer,
    distractors,
    ctx.rng,
  );
}

function phraseQuestion(item: PhraseItem, ctx: ExerciseContext): ChoiceQuestion | null {
  const pool = ctx.pool.filter((p): p is PhraseItem => p.type === 'phrase' && p.id !== item.id);
  const distractors = pickDistractors(pool.map((p) => p.meaning), item.meaning, OPTION_COUNT - 1, ctx.rng);
  return buildChoice(
    {
      itemId: item.id,
      exerciseType: 'phrase_meaning',
      prompt: 'What does this phrase mean?',
      subject: item.phrase,
      explanation: item.example,
      audioText: null,
    },
    item.meaning,
    distractors,
    ctx.rng,
  );
}

export const VOCABULARY_EXERCISES: readonly ExerciseType[] = [
  'meaning',
  'choose_word',
  'fill_blank',
  'synonym',
  'antonym',
  'translate',
  'listening',
];

function isAllowed(type: ExerciseType, ctx: ExerciseContext): boolean {
  return !ctx.allowedTypes || ctx.allowedTypes.includes(type);
}

/**
 * Generates a scored question for an item, or null when no allowed exercise
 * type can be built (e.g. a personal word that has not been enriched yet).
 */
export function generateQuiz(item: LearningItem, ctx: ExerciseContext): ChoiceQuestion | null {
  switch (item.type) {
    case 'grammar':
      return isAllowed('grammar_choice', ctx) ? grammarQuestion(item, ctx) : null;
    case 'phrase':
      return isAllowed('phrase_meaning', ctx) ? phraseQuestion(item, ctx) : null;
    case 'vocabulary': {
      const types = VOCABULARY_EXERCISES.filter((t) => isAllowed(t, ctx));
      // Try a varied order, keeping the previously used type as a last resort.
      const ordered = shuffle(types, ctx.rng).sort(
        (a, b) => Number(a === ctx.avoidType) - Number(b === ctx.avoidType),
      );
      for (const type of ordered) {
        const question = vocabularyBuilders[type]?.(item, ctx);
        if (question) return question;
      }
      return null;
    }
  }
}

export function introCard(item: LearningItem): CardQuestion {
  return { kind: 'card', itemId: item.id, exerciseType: 'intro', item };
}

/** Returns a quiz when possible and falls back to a self-graded card. */
export function generateQuestion(item: LearningItem, ctx: ExerciseContext): Question {
  return generateQuiz(item, ctx) ?? introCard(item);
}

export function isAnswerCorrect(question: ChoiceQuestion, selectedIndex: number): boolean {
  return selectedIndex === question.correctIndex;
}
