/**
 * Query keys. Everything derived from learning activity lives under `learning`,
 * so a single invalidation refreshes dashboard, progress and lists after an answer.
 */
export const queryKeys = {
  profile: ['profile'] as const,
  settings: ['settings'] as const,
  learning: ['learning'] as const,
  dashboard: (day: string) => ['learning', 'dashboard', day] as const,
  week: (day: string) => ['learning', 'week', day] as const,
  progress: (day: string) => ['learning', 'progress', day] as const,
  weekly: (day: string) => ['learning', 'weekly', day] as const,
  weeklyHistory: ['learning', 'weeklyHistory'] as const,
  pronunciation: ['learning', 'pronunciation'] as const,
  vocabulary: (search: string, level: string | null) => ['learning', 'vocabulary', search, level] as const,
  item: (id: string) => ['learning', 'item', id] as const,
  personalWords: ['learning', 'personal'] as const,
  personalWord: (id: string) => ['learning', 'personal', id] as const,
  alarms: ['alarms'] as const,
  alarm: (id: string) => ['alarms', id] as const,
  alarmPermissions: ['alarmPermissions'] as const,
  alarmSounds: ['alarmSounds'] as const,
  unlockStatus: ['unlockStatus'] as const,
};
