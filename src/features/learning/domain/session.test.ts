import { INTRO_QUIZ_GAP, RETRY_GAP, answerStep, createSession, currentStep, isComplete, summarize } from './session';

const always = () => true;

describe('createSession', () => {
  it('gives new items an intro card followed later by a quiz', () => {
    const state = createSession(
      [
        { itemId: 'n', reason: 'new' },
        { itemId: 'a', reason: 'due' },
        { itemId: 'b', reason: 'due' },
        { itemId: 'c', reason: 'due' },
        { itemId: 'd', reason: 'due' },
      ],
      always,
    );
    expect(state.steps[0]).toEqual({ itemId: 'n', mode: 'intro', reason: 'new' });
    expect(state.steps[1 + INTRO_QUIZ_GAP]).toEqual({ itemId: 'n', mode: 'quiz', reason: 'new' });
    expect(state.steps).toHaveLength(6);
  });

  it('uses a single card for items that cannot be quizzed', () => {
    const state = createSession([{ itemId: 'mine', reason: 'new' }, { itemId: 'old', reason: 'due' }], (id) => id !== 'mine' && id !== 'old');
    expect(state.steps.map((s) => s.mode)).toEqual(['intro', 'intro']);
  });
});

describe('answerStep', () => {
  it('re-queues a missed quiz once, a few steps later', () => {
    let state = createSession(
      ['a', 'b', 'c', 'd', 'e'].map((itemId) => ({ itemId, reason: 'due' as const })),
      always,
    );
    state = answerStep(state, { correct: false, exerciseType: 'meaning' });
    expect(state.steps[RETRY_GAP + 1]).toEqual({ itemId: 'a', mode: 'quiz', reason: 'retry' });
    expect(state.steps).toHaveLength(6);

    // Answer through to the retry and miss it again: no infinite loop.
    while (currentStep(state)?.reason !== 'retry') state = answerStep(state, { correct: true, exerciseType: 'meaning' });
    state = answerStep(state, { correct: false, exerciseType: 'meaning' });
    expect(state.steps).toHaveLength(6);
  });

  it('completes and summarises the session', () => {
    let state = createSession(
      [
        { itemId: 'n', reason: 'new' },
        { itemId: 'a', reason: 'due' },
      ],
      always,
    );
    const answers = [true, false, true, true]; // intro n, quiz a (miss), quiz n, retry a
    for (const correct of answers) state = answerStep(state, { correct, exerciseType: 'meaning' });
    expect(isComplete(state)).toBe(true);
    const summary = summarize(state);
    expect(summary).toMatchObject({ interactions: 4, quizzes: 3, correct: 2, newItems: 1, missedItemIds: [] });
    expect(summary.accuracy).toBeCloseTo(2 / 3);
  });
});
