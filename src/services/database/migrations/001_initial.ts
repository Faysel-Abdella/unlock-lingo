import type { Migration } from './index';

/**
 * Initial schema. Timestamps are epoch milliseconds, local days are `YYYY-MM-DD`,
 * booleans are 0/1 and list columns hold JSON validated at the repository layer.
 */
export const migration001: Migration = {
  version: 1,
  name: 'initial schema',
  sql: `
CREATE TABLE user_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  target_language TEXT NOT NULL,
  native_language TEXT,
  current_level TEXT NOT NULL,
  target_level TEXT NOT NULL,
  interests TEXT NOT NULL DEFAULT '[]',
  onboarded_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE learning_items (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('vocabulary', 'grammar', 'phrase')),
  language TEXT NOT NULL,
  cefr_level TEXT NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 5,
  tags TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL CHECK (source IN ('seed', 'user', 'ai')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_learning_items_lang_type ON learning_items (language, type, cefr_level);

CREATE TABLE vocabulary_items (
  item_id TEXT PRIMARY KEY NOT NULL REFERENCES learning_items (id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  pronunciation TEXT,
  part_of_speech TEXT,
  definition TEXT,
  example TEXT,
  translations TEXT NOT NULL DEFAULT '{}',
  synonyms TEXT NOT NULL DEFAULT '[]',
  antonyms TEXT NOT NULL DEFAULT '[]',
  audio_uri TEXT
);
CREATE INDEX idx_vocabulary_word ON vocabulary_items (word COLLATE NOCASE);

CREATE TABLE grammar_items (
  item_id TEXT PRIMARY KEY NOT NULL REFERENCES learning_items (id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  explanation TEXT NOT NULL,
  example TEXT NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  answer_explanation TEXT NOT NULL
);

CREATE TABLE phrase_items (
  item_id TEXT PRIMARY KEY NOT NULL REFERENCES learning_items (id) ON DELETE CASCADE,
  phrase TEXT NOT NULL,
  meaning TEXT NOT NULL,
  example TEXT NOT NULL,
  usage_note TEXT
);

CREATE TABLE learning_progress (
  item_id TEXT PRIMARY KEY NOT NULL REFERENCES learning_items (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'learning', 'reviewing', 'mastered', 'difficult')),
  fsrs_state TEXT NOT NULL DEFAULT 'new'
    CHECK (fsrs_state IN ('new', 'learning', 'review', 'relearning')),
  stability REAL NOT NULL DEFAULT 0,
  difficulty REAL NOT NULL DEFAULT 0,
  due_at INTEGER,
  last_reviewed_at INTEGER,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  seen_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  last_rating INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_progress_status_due ON learning_progress (status, due_at);
CREATE INDEX idx_progress_due ON learning_progress (due_at);

CREATE TABLE review_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL REFERENCES learning_items (id) ON DELETE CASCADE,
  exercise_type TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
  correct INTEGER NOT NULL,
  response_ms INTEGER,
  context TEXT NOT NULL CHECK (context IN ('session', 'unlock', 'alarm', 'weekly')),
  state_before TEXT NOT NULL,
  state_after TEXT NOT NULL,
  stability_before REAL NOT NULL,
  stability_after REAL NOT NULL,
  difficulty_before REAL NOT NULL,
  difficulty_after REAL NOT NULL,
  due_after INTEGER,
  reviewed_at INTEGER NOT NULL
);
CREATE INDEX idx_history_reviewed_at ON review_history (reviewed_at);
CREATE INDEX idx_history_item ON review_history (item_id, reviewed_at);

CREATE TABLE personal_vocabulary (
  id TEXT PRIMARY KEY NOT NULL,
  item_id TEXT NOT NULL UNIQUE REFERENCES learning_items (id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  context_note TEXT,
  source TEXT NOT NULL DEFAULT 'other'
    CHECK (source IN ('work', 'reading', 'conversation', 'article', 'book', 'other')),
  is_important INTEGER NOT NULL DEFAULT 0,
  is_difficult INTEGER NOT NULL DEFAULT 0,
  is_mastered INTEGER NOT NULL DEFAULT 0,
  enrichment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (enrichment_status IN ('pending', 'enriched', 'not_found')),
  added_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE daily_activity (
  date TEXT PRIMARY KEY NOT NULL,
  interactions INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  incorrect INTEGER NOT NULL DEFAULT 0,
  new_items INTEGER NOT NULL DEFAULT 0,
  reviews INTEGER NOT NULL DEFAULT 0,
  grammar_answered INTEGER NOT NULL DEFAULT 0,
  unlock_cards_shown INTEGER NOT NULL DEFAULT 0,
  alarm_challenges INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE weekly_stats (
  week_start TEXT PRIMARY KEY NOT NULL,
  snapshot TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE alarms (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  hour INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
  minute INTEGER NOT NULL CHECK (minute BETWEEN 0 AND 59),
  days_mask INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  question_count INTEGER NOT NULL DEFAULT 5,
  challenge_types TEXT NOT NULL DEFAULT '[]',
  snooze_enabled INTEGER NOT NULL DEFAULT 1,
  snooze_minutes INTEGER NOT NULL DEFAULT 9,
  max_snoozes INTEGER NOT NULL DEFAULT 3,
  vibrate INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE alarm_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alarm_id TEXT REFERENCES alarms (id) ON DELETE SET NULL,
  fired_at INTEGER NOT NULL,
  dismissed_at INTEGER,
  dismiss_method TEXT CHECK (dismiss_method IN ('challenge', 'emergency', 'timeout')),
  snooze_count INTEGER NOT NULL DEFAULT 0,
  questions_answered INTEGER NOT NULL DEFAULT 0,
  questions_correct INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_alarm_history_fired ON alarm_history (fired_at);
`,
};
