# Unlock Lingo

> **You don't open the language app. The language app meets you during your day.**

Unlock Lingo is an Android-first app for learning a language without scheduling study time.
It attaches tiny learning moments to two habits you already have:

1. **Waking up.** Turning off the alarm takes a short micro-challenge.
2. **Unlocking your phone.** A small, rate-limited learning card appears now and then.

Most moments take under 15 seconds. A local spaced-repetition engine (FSRS-5) decides what you
see, so reviews of older material always come before new words. Everything works offline.

## Status

| Phase | Scope | State |
| ----- | ----- | ----- |
| 1 | Project setup, navigation, SQLite and migrations, content schema and seed data, FSRS engine, vocabulary cards, My Words, progress tracking, dashboard, onboarding, settings | ✅ Done |
| 2 | Alarm creation, `AlarmManager` integration, full-screen alarm, learning challenge, reliable dismissal | ✅ Built; needs device testing (see [Alarm test checklist](#alarm-test-checklist)) |
| 3 | Unlock detection, interruption policy (cap, cooldown, quiet/work hours), notification fallback | ✅ Built; needs device testing (see [Unlock card test checklist](#unlock-card-test-checklist)) |
| 4 | Weekly review and quiz, weekly snapshots and analytics, gradual level mixing, voice selection and slow replay | ✅ Done |
| 5 | Optional AI personalisation | Planned |

The full plan, Android risk analysis and schema rationale are in
[`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).

## Tech stack

Expo SDK 57 (development build, **not** Expo Go) · React Native 0.86 · TypeScript (strict) ·
Expo Router · expo-sqlite · TanStack Query · Zod · expo-speech · Jest · a local Expo module in
Kotlin (`modules/alarm-clock`, `modules/unlock-cards`). Zustand is in the stack plan for lightweight client state, but
nothing needs it yet.

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

### Web preview

The UI also runs in a browser (React Native for Web). Use it for design reviews, not for
testing alarms or unlock cards, which are Android-only and are disabled there.

```bash
npm run web            # live dev server at http://localhost:8081
npm run preview:web    # one self-contained web-preview.html that opens anywhere, even offline
```

On web the database is [sql.js](https://sql.js.org) (SQLite compiled to WebAssembly), kept in
memory and saved to `localStorage`. It needs no cross-origin isolation headers.

### Quality checks

```bash
npm run typecheck      # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm run lint           # eslint (eslint-config-expo, no-explicit-any = error)
npm test               # jest: domain logic plus repositories on real SQLite
npm run check          # all three
```

The native modules' pure logic (`AlarmSpec.kt`, `CardPolicy.kt`) has JVM unit tests mirroring
the TypeScript ones. Run them from a generated project with
`cd android && ./gradlew :alarm-clock:testDebugUnitTest :unlock-cards:testDebugUnitTest`.

Repository and migration tests run against Node's built-in `node:sqlite`, through the same
`Database` interface that `expo-sqlite` satisfies. That means SQL is exercised in CI without a
device.

## Architecture

```
src/
  app/                    Expo Router routes only (thin screens)
    (tabs)/               Home · Learn · My Words · Progress · Settings
    onboarding.tsx        first-run profile setup
    session.tsx           Today's learning session (full-screen); `?kind=weekly` runs the weekly quiz
    weekly-review.tsx     weekly summary and quiz entry point
    vocabulary/           browser + item detail
    words/                add word + personal word detail
    alarms/               alarm list + editor
    alarm/ring.tsx        ringing challenge (deep link unlocklingo://alarm/ring?alarmId=…)
    unlock-settings.tsx   unlock learning settings (deep link unlocklingo://unlock-settings)
    card.tsx              full card opened from a card notification (unlocklingo://card?itemId=…)
  components/             design-system primitives (Text, Card, Button, Chip, …)
  theme/                  tokens (colors, spacing, radius, typography, shadows) + ThemeProvider
  features/
    learning/domain/      PURE TS: FSRS, review/status, queue, exercises, session, stats, level policy
    learning/             learningService (orchestration), hooks, session hook, cards
    alarms/domain/        PURE TS: next occurrence (DST-safe), snooze policy, challenge state machine
    alarms/               alarmService (sync, native event import, challenge content), hooks, screens' logic
    unlock/domain/        PURE TS: interruption policy (cap, cooldown, quiet/work hours, frequency), settings
    unlock/               unlockService (card deck, native sync, event import), hooks
    reviews/domain/       PURE TS: review week window, weekly stats, weekly quiz selection
    reviews/              weeklyService (load, prepare quiz, save snapshot), hooks
    audio/domain/         PURE TS: TTS voice selection, slow rate, pronunciation scoring
    audio/                pronunciation practice service, hook and SpeakCard
    progress/domain/      PURE TS: weekly trends, level-mix description, smart-difficulty status
    vocabulary/ settings/ onboarding/ progress/   feature hooks and components
  repositories/           SQL lives here only. One repository per aggregate, plus row mappers
  services/
    database/             Database interface, migrations, versioned seed content, test adapter
    audio/                PronunciationService (TTS with best-voice selection), SpeechRecognitionProvider (expo-speech-recognition)
    ai/                   AIContentProvider interface + offline default
  native/                 typed bridges to native modules, with no-op fallbacks
  hooks/                  repositories context, query keys, pronunciation, date
  types/                  shared domain types (languages, CEFR, learning items)
  utils/                  dates, seeded RNG
modules/
  alarm-clock/            local Expo module (Android, Kotlin): scheduler, receivers, ringing service
  unlock-cards/           local Expo module (Android, Kotlin): unlock listener, scheduled cards, card notifications
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

  New items are mixed by type within each level (60% vocabulary, 20% phrases, 20% grammar), so
  one type can't take every slot. A previously failed item counts as recovered after two correct
  answers in a row.
- **Smart difficulty.** New material comes from your current CEFR level, judged on the last 30
  days of answers. After 30+ answers the mix adapts gradually:

  | Accuracy at your level | New material |
  | ---------------------- | ------------ |
  | ≥ 95% | 50% current · 50% next |
  | ≥ 90% | 60% current · 40% next |
  | ≥ 85% | 75% current · 25% next |
  | < 60% | 70% current · 30% level below |

  Levels are interleaved by largest-deficit rounding, never past your target level. When the
  next level is also above 85%, the dashboard suggests moving up. Progress explains the current
  mix.

### Weekly review

- **When.** From your review day (Sunday by default; set it in Settings), the dashboard offers a
  review of the seven days ending that day, provided you practised that week. The offer stays
  until you complete it or the next review day replaces it. Learn → Weekly review opens it at
  any time.
- **Summary.** Words and phrases encountered, new ones learned, older ones reviewed, grammar
  questions, accuracy, streak and active days, the most difficult items and the newly mastered
  ones. A first-exposure "new to me" isn't scored, matching the scheduler.
- **Quiz.** Up to 16 questions, about 5–10 minutes: 60% items you struggled with (most mistakes
  first), then items first seen that week, then other items from the week. Mastered items are
  skipped. Answers update FSRS like any review (context `weekly`) but don't count towards the
  week being summarised.
- **Snapshots.** Completing the quiz saves the week to `weekly_stats`, so it isn't offered again
  and appears in Progress → Weekly reviews with its accuracy trend.

### Audio

- Text-to-speech picks the best installed voice per language: exact locale, then enhanced
  quality, then offline voices ahead of network ones. The choice is cached per locale.
- "Listen slowly" replays at 60% of your speech rate (minimum 0.4) on cards and listening
  questions.

### Speaking practice

Opt-in under Settings → Audio, because it needs the microphone.

- **In sessions.** Up to three "Say it out loud" steps per daily session, each right after an
  item's first quiz. Only words and phrases of up to five words qualify. You get up to three
  attempts, with Listen and Listen slowly. Speaking steps never re-queue an item or count as
  missed.
- **Anywhere.** Word detail screens have "Practise saying it".
- **Scoring.** Recogniser hypotheses are compared with the target text, ignoring case, accents
  and punctuation, and accepting the target inside a longer utterance. An exact match is
  "clear"; ≥ 75% similarity (edit distance) is "close", usually recognition noise; anything
  else is "unclear" and shows what was heard. The recogniser is not biased towards the expected
  word, so a mispronunciation isn't silently corrected into a match.
- **Practice only.** Attempts are stored in `pronunciation_attempts`, separate from FSRS history,
  and never change when a word comes back: recognisers mishear accents and noisy rooms.
  Progress shows how many attempts were understood and which words to practise again.
- **Engine.** `expo-speech-recognition` uses Android's `SpeechRecognizer`, on-device when that
  language's offline model is installed (otherwise the system recogniser, which may use the
  network). The provider sits behind `SpeechRecognitionProvider`, with a null implementation
  for devices without a recogniser.

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
| `alarms` (migration 3) | Adds `sound_uri`, `sound_title` (null = system default) and `gradual_volume` |
| `pronunciation_attempts` | Speaking practice: expected text, what was heard, similarity and verdict (migration 2). Never affects scheduling. |
| `weekly_stats` | One snapshot per completed weekly review (JSON, validated with Zod), keyed by week start |
| `alarms` / `alarm_history` | Alarm definitions, and every ring: fired time, snoozes, how it was dismissed (`challenge`, `emergency`, `timeout`), questions answered/correct |

**Seed content.** 100 vocabulary items, 30 grammar questions and 20 phrases, across B1, B2 and
C1. It is bundled as TypeScript, validated with Zod (including "the example contains the
headword"), and upserted by stable ID (`en-vocab-resilient`). Bump `CONTENT_VERSION` to ship
content updates; learner progress is never touched.

**My Words.** Enter just the word. If it is in the bundled dictionary it links to that entry and
is enriched immediately. Otherwise it becomes a user item you can fill in later, by hand now and
optionally through an `AIContentProvider` later. Until then it is reviewed as a self-graded card.

## Android permissions

| Permission | Declared by | Why |
| ---------- | ----------- | --- |
| `RECORD_AUDIO` | expo-speech-recognition | Only while you practise saying a word (opt-in). Requested when you turn on speaking practice. |
| `INTERNET` | Expo | Development client only (connecting to Metro). The app itself works offline. |
| `VIBRATE` | expo-haptics, alarm module | Haptic feedback; alarm vibration |
| `POST_NOTIFICATIONS` | alarm, unlock-cards modules | Alarms and learning cards are notifications. Requested at runtime (Android 13+) when you save an alarm or turn on unlock learning. |
| `SCHEDULE_EXACT_ALARM` | alarm module | Ring at the exact minute. Android 14+ denies it by default for new installs, so the app shows a shortcut to grant it. |
| `USE_FULL_SCREEN_INTENT` | alarm module | Show the challenge over the lock screen. Users can revoke it on Android 14+; the app shows a shortcut. |
| `RECEIVE_BOOT_COMPLETED` | alarm, unlock-cards modules | Re-schedule alarms and restore card delivery after a reboot |
| `FOREGROUND_SERVICE_SPECIAL_USE` | unlock-cards module | Only while "after I unlock" is on: the listener that notices unlocks (see below) |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | alarm module | Keep the alarm sound playing until it is dismissed |
| `WAKE_LOCK` | alarm module | Keep the CPU awake while the alarm rings |

`SYSTEM_ALERT_WINDOW` and external storage permissions are explicitly blocked in `app.json`.
The alarm screens list any missing permission with a one-sentence reason and a button to the
right system setting. Battery-optimisation exemption is offered as optional.

## Alarm architecture

Reliability matters more than visual polish. `expo-notifications` can't loop an alarm sound or
schedule `setAlarmClock` alarms, so alarms use a local Expo module, `modules/alarm-clock`
(Kotlin, autolinked). Its `AndroidManifest.xml` merges into the generated app, so `/android`
stays generated.

1. **Schedule.** SQLite is the source of truth. After every change, and on launch and
   foreground, `syncAlarms` sends all alarms to `AlarmClock.setAlarms`. Native code:
   - stores a copy in **device-protected storage**, readable before the first unlock after a
     reboot;
   - schedules each alarm with `AlarmManager.setAlarmClock()` (exact, Doze-exempt, shown in the
     status bar).

   If exact-alarm access is denied it falls back to `setAndAllowWhileIdle` (inexact) and the app
   warns the user.
2. **Survive.** `RescheduleReceiver` handles boot (including locked boot), app update, time and
   timezone changes, and exact-alarm permission changes. It rebuilds the schedule from the stored
   copy without JS. When an alarm fires, the receiver schedules the next occurrence natively
   (`AlarmSchedule.nextOccurrence` mirrors the TS function and has its own unit tests). A
   one-time alarm disables itself.
3. **Ring.** `AlarmRingingService` is a foreground service of type `mediaPlayback`:
   - plays the alarm's sound on the alarm stream (looping): the one chosen in the editor, or the
     system default if none was chosen or it can't be played. With gradual volume (on by default)
     it starts at 15% and rises along a quadratic curve to full volume over 60 s. It also vibrates
     and holds a wake lock;
   - posts a high-priority notification whose full-screen intent opens
     `unlocklingo://alarm/ring?alarmId=…`.

   While ringing, a lifecycle listener sets `showWhenLocked`/`turnScreenOn` on the app's
   activity, and clears them as soon as ringing stops.
4. **Challenge.** `prepareAlarmChallenge` draws due and difficult items first, then tops up from
   the learner's level, using only the alarm's question types. The alarm stops after N
   **correct** answers (default 5); a mistake just brings another question. Answers feed the
   learning engine with `context = 'alarm'`.
5. **Never trapped.**
   - The ring screen always shows a *press-and-hold (3 s)* emergency stop.
   - The notification adds an **Emergency stop** action after 2 minutes, handled natively, so it
     works even if the JS UI fails to load.
   - The service stops itself after **10 minutes**.
   - If no questions can be generated, the challenge resolves to a plain stop.
   - A stale "ringing" record left by a killed process expires, so it can never block later
     alarms.
6. **History.** The native side logs `fired`, `snoozed`, `stopped` (`challenge`, `emergency` or
   `timeout`) and `disabled` events. JS imports them into `alarm_history`; a snoozed alarm that
   rings again continues the same entry.

**Choices to revisit before release**

- **Foreground service type.** `mediaPlayback` fits "keep playing the alarm sound".
  `systemExempted` is documented for apps holding an exact-alarm permission. Check against
  current Play policy.
- **Exact-alarm permission.** `USE_EXACT_ALARM` is granted automatically but is reserved by Play
  policy for apps whose core function is an alarm clock. This app declares the user-grantable
  `SCHEDULE_EXACT_ALARM` instead.

### Alarm test checklist

The Kotlin scheduling logic is unit-tested, and the Android code compiles against the Android 14
framework classes. Ringing behaviour still has to be checked on a real device (Android 12, 13 and
14+, ideally including a Samsung or Xiaomi phone):

- [ ] Alarm rings on time with the app closed and swiped from recents
- [ ] Rings with the screen off and locked: challenge appears over the lock screen
- [ ] While using another app: heads-up notification, and tapping it opens the challenge
- [ ] Completing N correct answers stops the sound; the lock screen returns
- [ ] Press-and-hold emergency stop works; the notification's Emergency stop appears after 2 min
- [ ] Ringing stops by itself after 10 minutes
- [ ] Snooze rings again after the set minutes and respects the snooze limit
- [ ] Alarms survive reboot (also before the first unlock), app update, and time zone change
- [ ] A one-time alarm turns itself off after ringing, and the app shows it as off
- [ ] With exact alarms denied, the app warns the user and the alarm still fires (possibly late)
- [ ] `alarm_history` shows the right dismissal method for each case
- [ ] A chosen sound plays; deleting that ringtone falls back to the default sound
- [ ] Gradual volume starts quiet and reaches full volume after about a minute; off = full at once
- [ ] Sound preview in the editor stops when you leave the editor
- [ ] The wheel time picker snaps to a value after a fling, and TalkBack adjusts it by swiping up and down

## Unlock cards

Off until the learner turns it on. Defaults: up to 10 cards a day, at least 30 minutes apart,
quiet hours 23:00–07:00.

### What Android allows

- `ACTION_USER_PRESENT` (the unlock broadcast) **cannot** be received by a manifest receiver
  since Android 8. Only a running process that registered for it at runtime gets it.
- Opening an activity from the background is blocked since Android 10, so the app can't show a
  screen right after an unlock. Only fragile workarounds exist: overlay windows,
  accessibility-service abuse, or polling usage stats. The app uses **none** of them.
- The closest reliable experience is a **notification card** that appears right after an unlock.

### How it works (`modules/unlock-cards`)

- **"After I unlock" mode.** An opt-in foreground service registers for `USER_PRESENT` at
  runtime. Android requires such a service to show a small ongoing notification; it is silent
  and minimised, and tapping it opens the settings. No standard service type fits, so it uses
  `specialUse` with a declared reason. A Play release needs a justification in the Play Console.
- **"Spread through the day" mode** (fallback). No persistent service. Inexact, Doze-friendly
  `AlarmManager` slots spread cards evenly across the active part of the day.
- **Decision.** Every time, `CardPolicy.kt` (the Kotlin mirror of
  `src/features/unlock/domain/policy.ts`, unit-tested with the same cases) checks:
  - unlock learning is on;
  - the daily cap;
  - the cooldown;
  - quiet hours (also across midnight);
  - work hours on chosen days;
  - frequency.

  "A card after every unlock" is an explicit opt-in that skips cooldown and frequency only.
- **Content.** JS prepares a deck of up to 30 cards with the session priorities (due →
  difficult → failed → rationed new) and the chosen card types, so native code never needs
  JS to show one.
- **Interaction.** The card is a silent heads-up notification:
  - word, pronunciation, meaning and example;
  - actions *I know this*, *Review later* and *Save*;
  - tap to open the full card with *Listen* and *Dismiss*;
  - grammar cards open a quick question in the app;
  - swiping a card away is a dismissal and leaves progress unchanged.
- **Data.** Native code logs `shown`, `answered`, `saved` and `dismissed`. On launch and
  foreground, JS imports them:
  - answers become self-graded reviews with `context = 'unlock'`;
  - saved words go to My Words;
  - shown cards are counted per day.
- **Survival.** Delivery is restored after reboot, app update and clock changes. If Android
  refuses a foreground start, the module backs off instead of crashing.

### Unlock card test checklist

`CardPolicy.kt` is unit-tested, and the Android code compiles against the Android 14 framework
classes. Card delivery still has to be checked on a device:

- [ ] Turning it on asks for notifications; the persistent "Unlock learning is on" notification appears ("after I unlock" mode only)
- [ ] A card appears shortly after unlocking; no second card within the cooldown
- [ ] No cards during quiet hours (also after midnight) or work hours on work days
- [ ] The daily maximum stops cards; it resets the next day
- [ ] *I know this* / *Review later* / *Save* work from the notification and show up in the app afterwards
- [ ] Tapping a card opens the full card; *Listen* speaks the word
- [ ] Swiping a card away changes no progress
- [ ] "Spread through the day" mode delivers cards without the persistent notification
- [ ] Delivery resumes after reboot; turning unlock learning off stops everything
- [ ] OEM battery savers (Samsung, Xiaomi): check whether the listener survives a day

## Roadmap

- **Phase 2 follow-ups:** device testing (checklist above), and custom sounds from the user's
  own files (needs a document picker and persisted URI permissions).
- **Phase 3 follow-ups:** device testing (checklist above), a home-screen widget as a further
  low-interruption option, and Listen directly from the notification.
- **Phase 4 follow-ups:** prerecorded audio for seed content, a weekly-review reminder
  notification, charts over longer periods, and offering the offline speech model download
  (`androidTriggerOfflineModelDownload`) from settings.
- **Phase 5:** concrete `AIContentProvider` implementations: enrich My Words, write
  interest-tailored examples, generate exercises, explain mistakes. Always optional and
  replaceable.
