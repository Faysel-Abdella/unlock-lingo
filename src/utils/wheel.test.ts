import { wheelIndex, wrapIndex } from './wheel';

describe('wheel helpers', () => {
  it('snaps an offset to the nearest row within bounds', () => {
    expect(wheelIndex(0, 44, 24)).toBe(0);
    expect(wheelIndex(65, 44, 24)).toBe(1);
    expect(wheelIndex(67, 44, 24)).toBe(2);
    expect(wheelIndex(-30, 44, 24)).toBe(0);
    expect(wheelIndex(5000, 44, 24)).toBe(23);
    expect(wheelIndex(10, 44, 0)).toBe(0);
  });

  it('wraps increments and decrements', () => {
    expect(wrapIndex(23, 1, 24)).toBe(0);
    expect(wrapIndex(0, -1, 60)).toBe(59);
    expect(wrapIndex(10, -5, 60)).toBe(5);
  });
});
