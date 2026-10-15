import type { Database } from '@/services/database/types';

import { type ActivityRepository, createActivityRepository } from './activityRepository';
import { type AlarmRepository, createAlarmRepository } from './alarmRepository';
import { type ContentRepository, createContentRepository } from './contentRepository';
import {
  type PersonalVocabularyRepository,
  createPersonalVocabularyRepository,
} from './personalVocabularyRepository';
import { type ProfileRepository, createProfileRepository } from './profileRepository';
import { type ProgressRepository, createProgressRepository } from './progressRepository';

export interface Repositories {
  content: ContentRepository;
  progress: ProgressRepository;
  personal: PersonalVocabularyRepository;
  profile: ProfileRepository;
  activity: ActivityRepository;
  alarms: AlarmRepository;
}

export function createRepositories(db: Database): Repositories {
  const content = createContentRepository(db);
  const activity = createActivityRepository(db);
  return {
    content,
    activity,
    progress: createProgressRepository(db, activity),
    personal: createPersonalVocabularyRepository(db, content),
    profile: createProfileRepository(db),
    alarms: createAlarmRepository(db),
  };
}

export type { ActivityRepository, AlarmRepository, ContentRepository, PersonalVocabularyRepository, ProfileRepository, ProgressRepository };
