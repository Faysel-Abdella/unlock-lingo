import { pickVoice, slowRate } from './voices';

const voice = (identifier: string, language: string, quality = 'Default') => ({ identifier, language, quality });

describe('pickVoice', () => {
  it('prefers an exact locale over another region of the language', () => {
    const voices = [voice('en-gb-x-1-local', 'en-GB'), voice('en-us-x-1-local', 'en-US'), voice('de-x', 'de-DE')];
    expect(pickVoice(voices, 'en-US')?.identifier).toBe('en-us-x-1-local');
  });

  it('prefers enhanced and offline voices', () => {
    const voices = [
      voice('en-us-x-a-network', 'en-US', 'Enhanced'),
      voice('en-us-x-b-local', 'en-US'),
      voice('en-us-x-c-local', 'en-US', 'Enhanced'),
    ];
    expect(pickVoice(voices, 'en-US')?.identifier).toBe('en-us-x-c-local');
    expect(pickVoice(voices.slice(0, 2), 'en-US')?.identifier).toBe('en-us-x-b-local');
  });

  it('falls back to the same language and accepts underscore tags', () => {
    expect(pickVoice([voice('es_mx', 'es_MX')], 'es-ES')?.identifier).toBe('es_mx');
    expect(pickVoice([voice('fr', 'fr-FR')], 'de-DE')).toBeNull();
    expect(pickVoice([], 'en-US')).toBeNull();
  });
});

describe('slowRate', () => {
  it('slows the preferred rate without going below the floor', () => {
    expect(slowRate(1)).toBe(0.6);
    expect(slowRate(0.5)).toBe(0.4);
  });
});
