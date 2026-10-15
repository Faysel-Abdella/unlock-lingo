import type { Interest, LanguageCode } from '@/types/language';
import type { GrammarItem, VocabularyItem } from '@/types/learning';

/**
 * Optional AI layer. The app works fully offline without it: every method may
 * return null, and callers must fall back to bundled or user-entered content.
 * Concrete providers (any vendor, or an on-device model) implement this
 * interface; no vendor SDK is referenced outside its own provider module.
 */
export interface AIContentProvider {
  readonly id: string;
  isAvailable(): Promise<boolean>;
  /** Fill in definition, example, pronunciation, synonyms and translation for a user-added word. */
  enrichWord(word: string, ctx: AIContext): Promise<Partial<VocabularyItem> | null>;
  /** A fresh example sentence tailored to the learner's interests. */
  generateExample(item: VocabularyItem, ctx: AIContext): Promise<string | null>;
  generateGrammarQuestion(topic: string, ctx: AIContext): Promise<Omit<GrammarItem, 'id' | 'source'> | null>;
  /** Short explanation of why an answer was wrong. */
  explainMistake(question: string, chosen: string, correct: string, ctx: AIContext): Promise<string | null>;
}

export interface AIContext {
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode | null;
  interests: Interest[];
}

/** Default provider: AI features are off and the app relies on local content. */
export const offlineAIProvider: AIContentProvider = {
  id: 'offline',
  isAvailable: async () => false,
  enrichWord: async () => null,
  generateExample: async () => null,
  generateGrammarQuestion: async () => null,
  explainMistake: async () => null,
};
