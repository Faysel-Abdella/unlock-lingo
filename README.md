# Unlock Lingo

> **You don't open the language app. The language app meets you during your day.**

Unlock Lingo is an Android-first app for learning a language without scheduling study time.
It attaches tiny learning moments to two habits you already have:

1. **Waking up.** Turning off the alarm takes a short micro-challenge (Phase 2).
2. **Unlocking your phone.** A small, rate-limited learning card appears now and then (Phase 3).

Most moments take under 15 seconds. A local spaced-repetition engine (FSRS-5) decides what you
see, so reviews of older material always come before new words. Everything works offline.

## Status

| Phase | Scope | State |
| ----- | ----- | ----- |
| 1 | Project setup, navigation, SQLite and migrations, content schema and seed data, FSRS engine, vocabulary cards, My Words, progress tracking, dashboard, onboarding, settings | ✅ Done |
| 2 | Alarm creation, `AlarmManager` integration, full-screen alarm, learning challenge, reliable dismissal | Planned |
| 3 | Unlock detection, interruption policy (cap, cooldown, quiet/work hours), notification fallback | Planned |
| 4 | Weekly review, analytics snapshots, richer adaptive difficulty, audio improvements | Planned |
| 5 | Optional AI personalisation | Planned |

The full plan, Android risk analysis and schema rationale are in
[`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).

## Tech stack

Expo SDK 57 (development build, **not** Expo Go) · React Native 0.86 · TypeScript (strict) ·
Expo Router · expo-sqlite · TanStack Query · Zod · expo-speech · Jest. Zustand is in the stack
plan for lightweight client state, but Phase 1 doesn't need it yet. Native Kotlin modules arrive
in Phase 2.

## Getting started

Prerequisites: Node 22+, the Android SDK, and an emulator or a device with USB debugging.

```bash
npm install
npm run android        # expo run:android: generates /android, builds and installs the dev client
npm start              # Metro for the installed dev client
```

`/android` is generated (Continuous Native Generation) and git-ignored. Configure native
behaviour in `app.json` or config plugins, never by editing `/android`. To rebuild native code
from scratch, run `npx expo prebuild --platform android --clean`.

For a cloud build use EAS: `npx eas-cli@latest build --profile development --platform android`.

### Quality checks

```bash
npm run typecheck      # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm run lint           # eslint (eslint-config-expo, no-explicit-any = error)
npm test               # jest: domain logic plus repositories on real SQLite
npm run check          # all three
```

Repository and migration tests run against Node's built-in `node:sqlite`, through the same
`Database` interface that `expo-sqlite` satisfies. That means SQL is exercised in CI without a
device.

## Architecture

```
src/
  app/                    Expo Router routes only (thin screens)
    (tabs)/               Home · Learn · My Words · Progress · Settings
    onboarding.tsx        first-run profile setup
    session.tsx           Today's learning session (full-screen)
    vocabulary/           browser + item detail
    words/                add word + personal word detail
  components/             design-system primitives (Text, Card, Button, Chip, …)
  theme/                  tokens (colors, spacing, radius, typography, shadows) + ThemeProvider
  features/
    learning/domain/      PURE TS: FSRS, review/status, queue, exercises, session, stats, level policy
    learning/             learningService (orchestration), hooks, session hook, cards
    vocabulary/ settings/ onboarding/ progress/   feature hooks and components
  repositories/           SQL lives here only. One repository per aggregate, plus row mappers
  services/
    database/             Database interface, migrations, versioned seed content, test adapter
    audio/                PronunciationService (TTS now; recorded audio or ASR later)
    ai/                   AIContentProvider interface + offline default
  hooks/                  repositories context, query keys, pronunciation, date
  types/                  shared domain types (languages, CEFR, learning items)
  utils/                  dates, seeded RNG
```

Dependency direction: `app → features (hooks) → learningService → repositories → Database`,
with `features/learning/domain` at the core. The domain layer has no React, SQLite or Expo
imports.

### Learning engine

- **Content vs exercises.** Content is `vocabulary`, `grammar` or `phrase`. Exercises are
  generated from content at runtime:
  - meaning, choose the word, fill in the blank, synonym, antonym, translation (when a
    translation exists for your first language), listening, grammar multiple choice, phrase
    meaning;
  - an intro card for unseen items.

  Distractors come from the same part of speech. Words related in either direction (synonym or
  antonym) are excluded, so only one option is defensible.
- **Scheduling.** FSRS-5 with default weights and 90% target retention:
  - short learning steps (1, 5 or 10 minutes) for same-day repetition;
  - the FSRS-5 short-term stability formula for same-day reviews;
  - intervals ordered Hard ≤ Good < Easy;
  - a maximum interval of 365 days.

  A wrong answer rates Again, a slow correct answer (over 12 s) Hard, and a correct answer Good.
  Saying "new to me" on a first exposure isn't counted as a mistake.
- **Status.** `new → learning → reviewing → mastered` (stability ≥ 30 days and a correct streak
  of 3 or more), or `difficult` (3+ lapses, FSRS difficulty ≥ 8, or a 50%+ failure rate).
  Personal-word flags override it.
- **Queue priority.** Due reviews (most at risk first; personal and important words boosted) →
  difficult → previously failed → new. New items are rationed:
  - a daily cap;
  - none while 15 or more reviews are overdue;
  - at most 30% of a session while reviews wait;
  - a review always comes first.
- **Smart difficulty.** New material comes from your current CEFR level. After ≥ 85% accuracy
  over 30+ reviews the next level is mixed in, capped at your target level. Below 60% the level
  below is mixed in. When the next level is also mastered, the dashboard suggests moving up.

## Database schema

SQLite file `unlock-lingo.db`. Migrations live in `src/services/database/migrations`, are tracked
with `PRAGMA user_version`, and run in one transaction each. Never edit a shipped migration; add
a new one.

| Table | Purpose |
| ----- | ------- |
| `user_profile` | Singleton: target/first language, current/target CEFR level, interests, onboarding time |
| `app_settings` | Key/value JSON, validated by a Zod schema with per-field fallbacks |
| `app_meta` | Internal metadata such as `content_version` |
| `learning_items` | Base row for every item: type, language, CEFR level, content difficulty, tags, source (`seed`, `user`, `ai`) |
| `vocabulary_items` / `grammar_items` / `phrase_items` | Type-specific content, 1:1 with `learning_items` |
| `learning_progress` | Per item: status, FSRS state/stability/difficulty, due date, reps, lapses, seen/correct/incorrect counts, streak, confidence, last rating |
| `review_history` | Every answer with exercise type, rating, response time, context (`session`, `unlock`, `alarm`, `weekly`) and before/after scheduling state |
| `personal_vocabulary` | My Words: links to a learning item, plus context note, source and important/difficult/mastered flags, and enrichment status |
| `daily_activity` | Per-day counters: interactions, correct, incorrect, new, reviews, grammar, unlock cards, alarm challenges |
| `weekly_stats` | Weekly snapshots (Phase 4) |
| `alarms` / `alarm_history` | Alarm definitions and firing outcomes (Phase 2) |

**Seed content.** 100 vocabulary items, 30 grammar questions and 20 phrases, across B1, B2 and
C1. It is bundled as TypeScript, validated with Zod (including "the example contains the
headword"), and upserted by stable ID (`en-vocab-resilient`). Bump `CONTENT_VERSION` to ship
content updates; learner progress is never touched.

**My Words.** Enter just the word. If it is in the bundled dictionary it links to that entry and
is enriched immediately. Otherwise it becomes a user item you can fill in later, by hand now and
optionally through an `AIContentProvider` later. Until then it is reviewed as a self-graded card.

## Android permissions

| Permission | Phase | Why |
| ---------- | ----- | --- |
| `INTERNET` | 1 | Development client only (connecting to Metro). The app itself works offline. |
| `VIBRATE` | 1 | Haptic feedback on answers |
| `POST_NOTIFICATIONS` | 2/3 | Alarm notification and unlock-card notifications (runtime prompt on Android 13+, asked in context) |
| `SCHEDULE_EXACT_ALARM` or `USE_EXACT_ALARM` | 2 | Alarms must fire at the exact minute |
| `USE_FULL_SCREEN_INTENT` | 2 | Show the alarm challenge over the lock screen |
| `RECEIVE_BOOT_COMPLETED` | 2 | Re-schedule alarms after a reboot |
| `FOREGROUND_SERVICE` (+ type) | 2/3 | Keep the alarm ringing until dismissed; optional unlock listener |
| `WAKE_LOCK` | 2 | Keep the CPU awake while the alarm rings |

`SYSTEM_ALERT_WINDOW` and external storage permissions are explicitly blocked in `app.json`.
Every runtime permission will be requested in context, with a one-sentence explanation of why.

## Alarm architecture (Phase 2 design)

Reliability matters more than visual polish. `expo-notifications` can't loop an alarm sound or
schedule `setAlarmClock` alarms, so the alarm uses a local Expo module
(`modules/unlock-lingo-native`, Kotlin):

1. **Schedule.** SQLite is the source of truth. On every change, JS calls
   `scheduleAlarm(nextOccurrence)`. Native code uses `AlarmManager.setAlarmClock()` (exact,
   Doze-exempt, shown in the status bar). It also keeps a copy of the schedule in
   device-protected storage.
2. **Survive.** Receivers for `BOOT_COMPLETED`, `LOCKED_BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`,
   `TIME_SET` and `TIMEZONE_CHANGED` reschedule from that copy, without JS.
3. **Ring.** The alarm receiver starts a short-lived foreground service. It plays a looping
   alarm-stream sound, vibrates and holds a wake lock. It posts a high-priority notification
   with a full-screen intent to an activity that shows over the lock screen and opens the
   challenge route.
4. **Challenge.** N questions (default 5) are drawn by the same engine: due and difficult items,
   with types the user chose. Answers are recorded with `context = 'alarm'`.
5. **Never trapped.**
   - An emergency dismiss (long-press and confirm) is always available, both in JS and as a
     notification action handled natively.
   - The service stops itself after a maximum ring time.
   - If content can't be generated, the alarm falls back to a plain stop button.

   Every dismissal is logged in `alarm_history`.

## Unlock cards: Android limitations

- `ACTION_USER_PRESENT` (unlock) **cannot** be received by a manifest receiver since Android 8.
  Only a running process with a runtime-registered receiver gets it.
- Starting an activity from the background is blocked since Android 10. "Show a screen right
  after unlock" isn't possible without hacks.
- **Planned approach.** An *opt-in* foreground service, with a persistent quiet notification,
  listens for unlocks. It checks the interruption policy (daily cap, cooldown, quiet hours, work
  hours, frequency) and posts a heads-up **notification card** with the word and quick actions.
  Tapping it opens the full card.
- **Fallback.** No persistent service: cards are scheduled across the day using the same policy.
- **Not used:** accessibility services, overlay windows, `UsageStatsManager` polling. They are
  fragile, hostile to users, or against Play policy.
- Cards never appear after every unlock unless the user explicitly asks for that.

## Roadmap

- **Phase 2 (alarms):** alarm list and editor (time, repeat days, question count, challenge
  types, snooze), native scheduling module and config plugin, permission onboarding, ringing
  service, challenge screen, emergency dismiss, alarm history. Tests for challenge completion
  and next-occurrence calculation.
- **Phase 3 (unlock cards):** a pure interruption policy (cap, cooldown, quiet/work hours) with
  tests, the unlock listener service, notification cards, importing native-side answers into
  SQLite.
- **Phase 4:** weekly review (default Sunday, configurable): a summary plus a 5–10 minute quiz
  focused on difficult and recent items. Also `weekly_stats` snapshots, richer analytics,
  prerecorded audio, and a pronunciation exercise using speech recognition.
- **Phase 5:** concrete `AIContentProvider` implementations: enrich My Words, write
  interest-tailored examples, generate exercises, explain mistakes. Always optional and
  replaceable.
