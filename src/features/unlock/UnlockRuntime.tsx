import { useUnlockSync } from './hooks';

/** App-wide unlock-card plumbing (see useUnlockSync). Renders nothing. */
export function UnlockRuntime() {
  useUnlockSync();
  return null;
}
