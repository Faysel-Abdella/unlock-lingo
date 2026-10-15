import { isSpeakable, levenshtein, normalizeSpeech, scorePronunciation } from './pronunciation';

describe('normalizeSpeech', () => {
  it('ignores case, accents, punctuation and apostrophes', () => {
    expect(normalizeSpeech('  Café, s’il vous plaît!  ')).toBe('cafe sil vous plait');
    expect(normalizeSpeech("Don't")).toBe('dont');
  });
});

describe('levenshtein', () => {
  it('counts edits', () => {
    expect(levenshtein('resilient', 'resilent')).toBe(1);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});

describe('scorePronunciation', () => {
  it('accepts an exact match in any hypothesis, including inside a carrier phrase', () => {
    expect(scorePronunciation('resilient', [{ transcript: 'Brilliant', confidence: 0.6 }, { transcript: 'resilient', confidence: 0.3 }])).toEqual({
      verdict: 'clear',
      heard: 'resilient',
      similarity: 1,
    });
    expect(scorePronunciation('get the hang of', [{ transcript: 'I get the hang of it', confidence: 0.9 }]).verdict).toBe('clear');
  });

  it('treats near misses as close and different words as unclear', () => {
    expect(scorePronunciation('resilient', [{ transcript: 'resilent', confidence: 0.8 }])).toMatchObject({ verdict: 'close', heard: 'resilent' });
    expect(scorePronunciation('resilient', [{ transcript: 'brilliant', confidence: 0.8 }]).verdict).toBe('unclear');
    expect(scorePronunciation('resilient', [])).toEqual({ verdict: 'unclear', heard: null, similarity: 0 });
  });
});

describe('isSpeakable', () => {
  it('allows words and short phrases only', () => {
    expect(isSpeakable('resilient')).toBe(true);
    expect(isSpeakable('get the hang of')).toBe(true);
    expect(isSpeakable('The meeting has been postponed until next week')).toBe(false);
    expect(isSpeakable('!!')).toBe(false);
  });
});
