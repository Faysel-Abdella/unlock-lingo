import type { GrammarItem, LearningItem, VocabularyItem } from '@/types/learning';
import { createRng } from '@/utils/random';

import { blankOut, generateQuestion, generateQuiz, isAnswerCorrect, pickDistractors } from './exercises';

function vocab(word: string, extra: Partial<VocabularyItem> = {}): VocabularyItem {
  return {
    id: `v-${word}`,
    type: 'vocabulary',
    language: 'en',
    cefrLevel: 'B2',
    difficulty: 5,
    tags: [],
    source: 'seed',
    word,
    pronunciation: null,
    partOfSpeech: 'adjective',
    definition: `definition of ${word}`,
    example: `This sentence uses ${word} naturally.`,
    translations: { es: `${word}-es` },
    synonyms: [],
    antonyms: [],
    audioUri: null,
    ...extra,
  };
}

const resilient = vocab('resilient', { synonyms: ['tough', 'hardy'], antonyms: ['fragile'] });
const pool: LearningItem[] = [
  resilient,
  vocab('tough'),
  vocab('fragile'),
  vocab('candid'),
  vocab('meticulous'),
  vocab('reluctant'),
  vocab('ambiguous'),
];

describe('pickDistractors', () => {
  it('excludes the answer, duplicates and banned values case-insensitively', () => {
    const result = pickDistractors(['Goes', 'go', 'GO', 'going', 'gone', ''], 'goes', 5, createRng(1), ['gone']);
    expect(result.sort()).toEqual(['go', 'going']);
  });
});

describe('blankOut', () => {
  it('blanks whole-word matches only', () => {
    expect(blankOut('She remained resilient despite it.', 'resilient')).toBe('She remained _____ despite it.');
    expect(blankOut('Resilience matters.', 'resilient')).toBeNull();
  });
});

describe('generateQuiz', () => {
  it('always includes exactly one correct option', () => {
    for (let seed = 0; seed < 40; seed++) {
      const q = generateQuiz(resilient, { pool, nativeLanguage: 'es', rng: createRng(seed) });
      expect(q).not.toBeNull();
      expect(new Set(q!.options.map((o) => o.toLowerCase())).size).toBe(q!.options.length);
      expect(q!.options.length).toBeGreaterThanOrEqual(3);
      expect(isAnswerCorrect(q!, q!.correctIndex)).toBe(true);
    }
  });

  it('never offers a synonym of the word as a wrong answer in a synonym question', () => {
    for (let seed = 0; seed < 20; seed++) {
      const q = generateQuiz(resilient, { pool, nativeLanguage: null, rng: createRng(seed), allowedTypes: ['synonym'] });
      const wrong = q!.options.filter((_, i) => i !== q!.correctIndex);
      expect(wrong).not.toContain('tough');
      expect(wrong).not.toContain('hardy');
    }
  });

  it('builds an antonym question from the antonym list', () => {
    const q = generateQuiz(resilient, { pool, nativeLanguage: null, rng: createRng(3), allowedTypes: ['antonym'] });
    expect(q!.options[q!.correctIndex]).toBe('fragile');
  });

  it('builds a translation question only when a translation exists', () => {
    const allowedTypes = ['translate'] as const;
    expect(generateQuiz(resilient, { pool, nativeLanguage: 'es', rng: createRng(1), allowedTypes })).toMatchObject({
      exerciseType: 'translate',
    });
    expect(generateQuiz(resilient, { pool, nativeLanguage: 'fr', rng: createRng(1), allowedTypes })).toBeNull();
  });

  it('builds a listening question with audio and no visible word', () => {
    const q = generateQuiz(resilient, { pool, nativeLanguage: null, rng: createRng(2), allowedTypes: ['listening'] });
    expect(q).toMatchObject({ exerciseType: 'listening', subject: null, audioText: 'resilient' });
  });

  it('avoids repeating the previous exercise type when alternatives exist', () => {
    for (let seed = 0; seed < 20; seed++) {
      const q = generateQuiz(resilient, { pool, nativeLanguage: null, rng: createRng(seed), avoidType: 'meaning' });
      expect(q!.exerciseType).not.toBe('meaning');
    }
  });

  it('uses the authored options for grammar questions', () => {
    const grammar: GrammarItem = {
      id: 'g1',
      type: 'grammar',
      language: 'en',
      cefrLevel: 'B1',
      difficulty: 3,
      tags: [],
      source: 'seed',
      rule: 'Present simple, third person',
      explanation: '',
      example: '',
      question: 'She ___ to work every morning.',
      options: ['go', 'goes', 'going', 'gone'],
      correctAnswer: 'goes',
      answerExplanation: 'Third person singular takes -s.',
    };
    const q = generateQuiz(grammar, { pool: [], nativeLanguage: null, rng: createRng(5) });
    expect(q!.options.sort()).toEqual(['go', 'goes', 'going', 'gone']);
    expect(q!.options[q!.correctIndex]).toBe('goes');
  });
});

describe('generateQuestion', () => {
  it('falls back to a self-graded card for an unenriched personal word', () => {
    const bare = vocab('serendipity', { definition: null, example: null, translations: {}, source: 'user' });
    const q = generateQuestion(bare, { pool: [bare], nativeLanguage: null, rng: createRng(1) });
    expect(q.kind).toBe('card');
  });
});
