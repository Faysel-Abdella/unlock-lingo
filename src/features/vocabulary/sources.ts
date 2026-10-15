import type { WordSource } from '@/repositories/personalVocabularyRepository';

export const SOURCE_LABELS: Record<WordSource, string> = {
  work: 'Work',
  reading: 'Reading',
  conversation: 'Conversation',
  article: 'Article',
  book: 'Book',
  other: 'Other',
};
