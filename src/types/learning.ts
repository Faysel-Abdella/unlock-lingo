import type { CefrLevel, LanguageCode } from './language';

export type LearningItemType = 'vocabulary' | 'grammar' | 'phrase';
export type ItemSource = 'seed' | 'user' | 'ai';

interface LearningItemBase {
  id: string;
  type: LearningItemType;
  language: LanguageCode;
  cefrLevel: CefrLevel;
  /** Intrinsic content difficulty, 1 (easy) to 10 (hard). Not the FSRS difficulty. */
  difficulty: number;
  tags: string[];
  source: ItemSource;
}

export interface VocabularyItem extends LearningItemBase {
  type: 'vocabulary';
  word: string;
  pronunciation: string | null;
  partOfSpeech: string | null;
  definition: string | null;
  example: string | null;
  /** Map of language code to translation, e.g. `{ es: 'resiliente' }`. */
  translations: Partial<Record<LanguageCode, string>>;
  synonyms: string[];
  antonyms: string[];
  audioUri: string | null;
}

export interface GrammarItem extends LearningItemBase {
  type: 'grammar';
  rule: string;
  explanation: string;
  example: string;
  /** Prompt containing `___` where the answer belongs. */
  question: string;
  options: string[];
  correctAnswer: string;
  answerExplanation: string;
}

export interface PhraseItem extends LearningItemBase {
  type: 'phrase';
  phrase: string;
  meaning: string;
  example: string;
  usageNote: string | null;
}

export type LearningItem = VocabularyItem | GrammarItem | PhraseItem;

/** User-facing learning status, derived from FSRS state and performance. */
export type LearningStatus = 'new' | 'learning' | 'reviewing' | 'mastered' | 'difficult';

/** FSRS card state. */
export type FsrsState = 'new' | 'learning' | 'review' | 'relearning';

/** FSRS rating: Again, Hard, Good, Easy. */
export type Rating = 1 | 2 | 3 | 4;

export interface LearningProgress {
  itemId: string;
  status: LearningStatus;
  fsrsState: FsrsState;
  /** FSRS stability in days. 0 for new cards. */
  stability: number;
  /** FSRS difficulty, 1 to 10. 0 for new cards. */
  difficulty: number;
  dueAt: number | null;
  lastReviewedAt: number | null;
  reps: number;
  lapses: number;
  seenCount: number;
  correctCount: number;
  incorrectCount: number;
  /** Consecutive correct answers. */
  streak: number;
  /** 0 to 1. Predicted recall probability at the last review. */
  confidence: number;
  lastRating: Rating | null;
}

export type ExerciseType =
  | 'intro'
  | 'meaning'
  | 'choose_word'
  | 'fill_blank'
  | 'synonym'
  | 'antonym'
  | 'translate'
  | 'listening'
  | 'grammar_choice'
  | 'phrase_meaning'
  // Reserved for later phases.
  | 'pronunciation'
  | 'sentence_correction';

export type ReviewContext = 'session' | 'unlock' | 'alarm' | 'weekly';

export interface PersonalWordFlags {
  isImportant: boolean;
  isDifficult: boolean;
  isMastered: boolean;
}
