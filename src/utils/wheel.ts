/** Index of the row centred in a wheel scrolled to `offset`, clamped to the list. */
export function wheelIndex(offset: number, itemHeight: number, count: number): number {
  if (count <= 0 || itemHeight <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(offset / itemHeight)));
}

/** Moves `index` by `delta`, wrapping around (23 → 0 for hours). */
export function wrapIndex(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (((index + delta) % count) + count) % count;
}
