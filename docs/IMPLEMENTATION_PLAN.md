# Unlock Lingo: implementation plan

> You don't open the language app. The language app meets you during your day.

This document holds the plan written before coding started. It covers phases, Android platform
risks, which parts need native Kotlin, and the database schema. The README describes the code
as it is now. This file records the design intent behind it.

## 1. Plan

| Phase | Scope | Native code |
| ----- | ----- | ----------- |
| **1** | Project setup, navigation, SQLite and migrations, learning-item schema, seed content, FSRS engine, queue prioritisation, vocabulary cards, My Words, progress tracking, dashboard, onboarding, settings | None |
| **2** | Alarm CRUD, `AlarmManager` scheduling, boot rescheduling, full-screen ringing, learning challenge, emergency dismiss, snooze | Kotlin module and config plugin |
| **3** | Unlock detection (opt-in foreground service), interruption policy (daily cap, cooldown, quiet/work hours), notification card fallback | Kotlin service and receivers |
| **4** | Weekly review and quiz, weekly snapshots and analytics, gradual level mixing, voice selection and slow replay, speech recognition interface | None |
| **5** | Optional AI personalisation behind `AIContentProvider` | None |

Guiding rules:

- **Domain logic is pure TypeScript.** FSRS, queue building, exercise generation, streaks, level
  policy and (later) interruption policy and alarm-challenge state are plain functions with no
  React or SQLite imports. They are unit-tested in Node.
- **Repositories own SQL.** Screens talk to hooks. Hooks talk to repositories through React Query.
  Repositories depend on a tiny `Database` interface that `expo-sqlite` satisfies, and that tests
  satisfy with Node's built-in `node:sqlite`. That lets migrations and queries run against a real
  SQLite engine in CI.
- **Offline first.** All content, progress, settings and history live in one local SQLite file.
  Network features are additive and optional.

## 2. Android platform risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| **Exact alarm permission.** Android 12+ needs `SCHEDULE_EXACT_ALARM`. Android 14+ denies it by default for new installs. `USE_EXACT_ALARM` is auto-granted, but Google Play restricts it to apps whose core function is an alarm clock or calendar. | Alarms could fire late, or not at all. | Use `AlarmManager.setAlarmClock()` (exact, Doze-exempt, shows the system alarm icon). Check `canScheduleExactAlarms()` and deep-link to `ACTION_REQUEST_SCHEDULE_EXACT_ALARM`. Listen for `ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED`. Decide on `USE_EXACT_ALARM` vs `SCHEDULE_EXACT_ALARM` against current Play policy at release time. |
| **Full-screen intents.** Android 14+ limits `USE_FULL_SCREEN_INTENT` to calling and alarm apps, and users can revoke it. | The ringing UI may show as a heads-up notification instead of taking over the screen. | Check `NotificationManager.canUseFullScreenIntent()` and offer `ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT`. The notification itself must always be enough to stop the alarm (an emergency action). |
| **Foreground-service types (Android 14+).** Every FGS must declare a type. Starting one from the background is restricted, but an exact alarm firing is an allowed exemption. | Crash (`MissingForegroundServiceTypeException`) or service start blocked. | The ringing service runs only while ringing. It is started from the alarm receiver. Candidate type: `systemExempted` (documented for apps holding the exact-alarm permission) or `mediaPlayback`. Verify against the target SDK's documentation in Phase 2. |
| **Notification permission (Android 13+).** `POST_NOTIFICATIONS` is a runtime permission. | Without it, there is no visible alarm notification and no unlock-card notifications. | Ask in context, with an explanation, when the first alarm or unlock learning is enabled. |
| **Reboot, app update, time change.** `AlarmManager` alarms are cleared on reboot. | Alarms silently lost. | `RECEIVE_BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `TIME_SET` and `TIMEZONE_CHANGED` receivers reschedule from a native-side copy of the schedule. JS does not need to run. Before first unlock after boot, only device-protected storage is readable, so the schedule copy must live there (`createDeviceProtectedStorageContext`). |
| **OEM battery killers** (Xiaomi, Huawei, Samsung "deep sleep"). | Alarms delayed or the app killed. | `setAlarmClock` is the most robust API. Detect battery optimisation (`isIgnoringBatteryOptimizations`) and explain how to exempt the app. Never claim more reliability than the platform gives. |
| **Unlock detection.** `ACTION_USER_PRESENT` cannot be registered in the manifest (implicit-broadcast ban since Android 8). It is only delivered to a receiver registered at runtime by a live process. Background activity starts are blocked (Android 10+). | No "open a card after unlock" without a running process, and no launching UI directly. | See §3. Opt-in foreground service listens for `USER_PRESENT`, then posts a quiet notification card. Scheduled notifications are the fallback. |
| **Play policy on foreground services.** The unlock listener fits no specific FGS type, so it would use `specialUse`, which needs a Play Console justification. | Store review friction. | Strictly opt-in, clearly explained, with a persistent low-importance notification. The fallback mode works without the service. |
| **Alarm UI depends on JS.** If the JS bundle fails to load while ringing, a JS-only challenge could trap the user. | User cannot stop the alarm. | The native notification always carries an emergency path. The ringing service auto-stops after a maximum ring duration. The emergency dismiss is implemented natively, not only in JS. |

## 3. What needs native Kotlin

| Capability | Expo API enough? | Plan |
| ---------- | ---------------- | ---- |
| SQLite, TTS, haptics, routing | Yes | `expo-sqlite`, `expo-speech`, `expo-haptics`, Expo Router |
| Exact alarms that survive reboot | **No.** `expo-notifications` schedules notifications, not `setAlarmClock` alarms, and does not hold audio focus or loop a ringtone. | Kotlin `AlarmScheduler` (AlarmManager), `AlarmReceiver`, `BootReceiver` |
| Ringing that keeps going until dismissed | **No** | Foreground `AlarmRingingService` (looping audio on the alarm stream, vibration, wake lock, max-duration timeout) |
| Full-screen alarm over the lock screen | **No** | Notification with `setFullScreenIntent`. The target activity sets `setShowWhenLocked(true)` and `setTurnScreenOn(true)`, then deep-links into the RN challenge route. |
| Unlock events | **No** | Opt-in `UnlockListenerService` (FGS) registering a runtime receiver for `ACTION_USER_PRESENT` |
| Permission state queries | **No** | Module methods: `canScheduleExactAlarms`, `canUseFullScreenIntent`, `isIgnoringBatteryOptimizations`, plus openers for each settings screen |

The native code lives in `modules/alarm-clock` as a local Expo module (Kotlin). Its own
`AndroidManifest.xml` declares the receivers, service and permissions, and the manifest merger
adds them to the generated app, so no config plugin is needed and `/android` stays generated.
JS reaches it only through `src/native/`, which exports typed wrappers and no-op fallbacks for
non-Android platforms and tests.

### Unlock-card delivery options (Phase 3)

1. **Recommended: opt-in unlock listener.** An FGS holds a runtime `USER_PRESENT` receiver. On
   unlock, it asks a native interruption policy (cap, cooldown, quiet/work hours; mirrored from
   settings) whether a card is allowed, then posts a high-priority notification. The notification
   shows the word, with "I know this" and "Review later" actions and a tap to open the full card.
   Action results are queued natively and imported into SQLite when JS next runs.
2. **Fallback: scheduled moments.** No persistent service. Notifications are spread across the
   user's active hours, using the same policy. Not tied to unlocks, but reliable and battery
   friendly.
3. **Excluded:** accessibility services (policy violation), `SYSTEM_ALERT_WINDOW` overlays (hostile
   UX, heavy Play scrutiny), and polling `UsageStatsManager` (fragile).

## 4. Learning engine design

- **Content vs exercises.** Content items are `vocabulary`, `grammar` and `phrase`. Exercise types
  are derived from content at runtime:
  - Vocabulary: `meaning`, `choose_word`, `fill_blank`, `synonym`, `antonym`, `translate` (when a
    translation exists for the user's native language), `listening`.
  - Grammar: `grammar_choice`.
  - Phrase: `phrase_meaning`.
  - Unseen items get an `intro` card.
  - `pronunciation`: optional speaking practice judged by a speech recogniser. It is stored
    separately and never changes FSRS state. `sentence_correction` is still reserved.
- **FSRS-5 scheduler.** Default 19 weights, desired retention 0.9, and a maximum interval of 365
  days. Short learning steps keep same-day repetition alive. Same-day reviews use FSRS-5's
  short-term stability formula. Answers map to ratings: wrong → Again, correct but slow → Hard,
  correct → Good, and the intro card's "I know this" → Good.
- **Status** is derived after every review and stored for querying: `new`, `learning`,
  `reviewing`, `mastered` (stability ≥ 30 days and a correct streak of 3 or more), or `difficult`
  (3+ lapses, FSRS difficulty ≥ 8, or a recent fail ratio ≥ 50%). User flags from My Words
  override it.
- **Queue priority:** due reviews (most at-risk first, personal/important boosted) → difficult →
  previously failed → new. New items are gated:
  - a daily new-item cap;
  - no new items while due backlog ≥ 15;
  - new items limited to 30% of a session.

  New items are picked personal-first, then by CEFR band from the level policy, then interest
  tags. Within each level they are mixed by type (60% vocabulary, 20% phrases, 20% grammar).
- **Level policy:** start at the user's current CEFR level. With ≥ 30 answers in the last 30
  days at that level, the next level is mixed in gradually: 25% of new items at ≥ 85% accuracy,
  40% at ≥ 90%, 50% at ≥ 95%. Never past the target level. Below 60%, 30% of new items come
  from the level below. Levels are interleaved by largest-deficit rounding.
- **Weekly review (Phase 4):** the week ends on the configured review day. Stats come from
  `review_history`, excluding the weekly quiz's own answers. The quiz takes 60% struggling items,
  then items first seen that week, then the rest, skipping mastered ones. Completing it stores a
  Zod-validated snapshot in `weekly_stats`.

## 5. Database schema (migration 1)

All timestamps are INTEGER epoch milliseconds. Local calendar days are `TEXT` `YYYY-MM-DD`.
Booleans are `INTEGER` 0/1. Lists are JSON `TEXT` validated with Zod at the repository boundary.
Migrations are tracked with `PRAGMA user_version`. Each one runs in its own transaction.

```
user_profile        id=1 singleton: target_language, native_language, current_level, target_level,
                    interests(JSON), onboarded_at, created_at, updated_at
app_settings        key PK, value(JSON): daily goal, new items/day, theme, speech rate,
                    unlock/alarm/weekly defaults (validated by a Zod schema with defaults)
app_meta            key PK, value: content_version, etc.

learning_items      id PK, type(vocabulary|grammar|phrase), language, cefr_level, difficulty(1–10),
                    tags(JSON), source(seed|user|ai), created_at, updated_at
vocabulary_items    item_id PK→learning_items, word, pronunciation, part_of_speech, definition,
                    example, translations(JSON map lang→text), synonyms(JSON), antonyms(JSON), audio_uri
grammar_items       item_id PK→learning_items, rule, explanation, example, question, options(JSON),
                    correct_answer, answer_explanation
phrase_items        item_id PK→learning_items, phrase, meaning, example, usage_note

learning_progress   item_id PK→learning_items, status, fsrs_state, stability, difficulty, due_at,
                    last_reviewed_at, reps, lapses, seen_count, correct_count, incorrect_count,
                    streak, confidence, last_rating, created_at, updated_at
                    INDEX(status, due_at)
review_history      id PK, item_id, exercise_type, rating, correct, response_ms, context
                    (session|unlock|alarm|weekly), state/stability/difficulty before+after,
                    due_after, reviewed_at        INDEX(reviewed_at), INDEX(item_id)

personal_vocabulary id PK, item_id→learning_items (UNIQUE), word, context_note, source
                    (work|reading|conversation|article|book|other), is_important, is_difficult,
                    is_mastered, enrichment_status(pending|enriched|not_found), added_at, updated_at

daily_activity      date PK, interactions, correct, incorrect, new_items, reviews,
                    grammar_answered, unlock_cards_shown, alarm_challenges, updated_at
weekly_stats        week_start PK, snapshot(JSON), created_at                (Phase 4)

-- migration 2
pronunciation_attempts  id PK, item_id, expected, heard, similarity, verdict(clear|close|unclear),
                    attempted_at                         (speaking practice; never affects FSRS)

alarms              id PK, label, hour, minute, days_mask(bit0=Mon), enabled, question_count,
                    challenge_types(JSON), snooze_enabled, snooze_minutes, max_snoozes, vibrate,
                    created_at, updated_at                                  (used in Phase 2)
alarm_history       id PK, alarm_id, fired_at, dismissed_at, dismiss_method(challenge|emergency|
                    timeout), snooze_count, questions_answered, questions_correct   (Phase 2)
```

Seed content is versioned (`app_meta.content_version`). It is upserted by stable IDs
(`en-vocab-resilient`), so content updates never overwrite user progress.
