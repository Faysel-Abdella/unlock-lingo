import type { Migration } from './index';

/** Per-alarm sound (null = the system default alarm sound) and gradual volume. */
export const migration003: Migration = {
  version: 3,
  name: 'alarm sound and gradual volume',
  sql: `
ALTER TABLE alarms ADD COLUMN sound_uri TEXT;
ALTER TABLE alarms ADD COLUMN sound_title TEXT;
ALTER TABLE alarms ADD COLUMN gradual_volume INTEGER NOT NULL DEFAULT 1;
`,
};
