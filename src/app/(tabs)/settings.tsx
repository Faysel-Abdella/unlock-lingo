import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, Linking, View } from 'react-native';

import { Button, Card, Chip, Screen, SectionHeader, Text } from '@/components';
import { useNotificationPermission, useSetWeeklyReminder } from '@/features/reviews/reminderHooks';
import { SettingRow, Stepper, ToggleRow } from '@/features/settings/components';
import { useProfile, useResetProgress, useSaveProfile, useSettings, useUpdateSettings } from '@/features/settings/hooks';
import type { AppSettings, UserProfile } from '@/features/settings/schema';
import { speechRecognitionProvider } from '@/services/audio/speechRecognition';
import { reminderScheduler } from '@/services/notifications/reminders';
import { useTheme } from '@/theme/ThemeProvider';
import {
  CEFR_LEVELS,
  INTERESTS,
  INTEREST_LABELS,
  LANGUAGES,
  type LanguageCode,
  cefrIndex,
} from '@/types/language';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REMINDER_TIMES: { label: string; hour: number }[] = [
  { label: '9:00', hour: 9 },
  { label: '12:00', hour: 12 },
  { label: '18:00', hour: 18 },
  { label: '20:00', hour: 20 },
];
const SPEECH_RATES: { label: string; value: number }[] = [
  { label: 'Slow', value: 0.7 },
  { label: 'Natural', value: 0.9 },
  { label: 'Fast', value: 1.1 },
];

export default function Settings() {
  const settings = useSettings().data;
  const profile = useProfile().data;
  if (!settings || !profile) return <Screen>{null}</Screen>;
  return <SettingsForm settings={settings} profile={profile} />;
}

function Wrap({ children }: { children: React.ReactNode }) {
  const { spacing } = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{children}</View>;
}

function WeeklyReminderSetting({ settings, onChange }: { settings: AppSettings; onChange: (patch: Partial<AppSettings>) => void }) {
  const permission = useNotificationPermission().data;
  const setReminder = useSetWeeklyReminder();
  const reminder = settings.weeklyReminder;
  const blocked = permission === 'denied';
  const hint = !reminderScheduler.available
    ? 'Available in the Android app.'
    : blocked
      ? 'Notifications are turned off for Unlock Lingo. Allow them in system settings first.'
      : `A notification on ${WEEKDAYS[settings.weeklyReviewDay]} when your weekly review is ready. Weeks without learning are skipped.`;
  return (
    <>
      <ToggleRow
        label="Remind me on review day"
        hint={hint}
        value={reminder.enabled && !blocked}
        onChange={(enabled) => {
          if (!reminderScheduler.available) return;
          if (enabled && blocked) void Linking.openSettings();
          else setReminder.mutate(enabled);
        }}
      />
      {reminder.enabled && !blocked ? (
        <SettingRow label="Reminder time">
          <Wrap>
            {REMINDER_TIMES.map((time) => (
              <Chip
                key={time.label}
                label={time.label}
                selected={reminder.hour === time.hour && reminder.minute === 0}
                onPress={() => onChange({ weeklyReminder: { ...reminder, hour: time.hour, minute: 0 } })}
              />
            ))}
          </Wrap>
        </SettingRow>
      ) : null}
    </>
  );
}

function SettingsForm({ settings, profile }: { settings: AppSettings; profile: UserProfile }) {
  const update = useUpdateSettings();
  const saveProfile = useSaveProfile();
  const reset = useResetProgress();
  const set = (patch: Partial<AppSettings>) => update.mutate(patch);
  const setProfile = (patch: Partial<UserProfile>) => saveProfile.mutate({ ...profile, ...patch });

  const confirmReset = () =>
    Alert.alert(
      'Reset learning progress?',
      'Review history, schedules and streaks will be cleared. My Words and settings are kept. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => reset.mutate() },
      ],
    );

  return (
    <Screen>
      <Text variant="title">Settings</Text>

      <SectionHeader title="Learning profile" />
      <Card>
        <SettingRow label="Current level" hint="New material starts here and adapts to your answers.">
          <Wrap>
            {CEFR_LEVELS.filter((l) => l !== 'C2').map((level) => (
              <Chip
                key={level}
                label={level}
                selected={profile.currentLevel === level}
                onPress={() =>
                  setProfile({
                    currentLevel: level,
                    targetLevel: cefrIndex(profile.targetLevel) < cefrIndex(level) ? level : profile.targetLevel,
                  })
                }
              />
            ))}
          </Wrap>
        </SettingRow>
        <SettingRow label="Target level">
          <Wrap>
            {CEFR_LEVELS.filter((l) => cefrIndex(l) >= cefrIndex(profile.currentLevel)).map((level) => (
              <Chip key={level} label={level} selected={profile.targetLevel === level} onPress={() => setProfile({ targetLevel: level })} />
            ))}
          </Wrap>
        </SettingRow>
        <SettingRow label="Interests">
          <Wrap>
            {INTERESTS.map((interest) => {
              const selected = profile.interests.includes(interest);
              return (
                <Chip
                  key={interest}
                  label={INTEREST_LABELS[interest]}
                  selected={selected}
                  onPress={() =>
                    setProfile({
                      interests: selected
                        ? profile.interests.filter((i) => i !== interest)
                        : [...profile.interests, interest],
                    })
                  }
                />
              );
            })}
          </Wrap>
        </SettingRow>
        <SettingRow label="First language" hint="Used for translation exercises.">
          <Wrap>
            {(Object.keys(LANGUAGES) as LanguageCode[])
              .filter((c) => c !== profile.targetLanguage)
              .map((code) => (
                <Chip
                  key={code}
                  label={LANGUAGES[code].name}
                  selected={profile.nativeLanguage === code}
                  onPress={() => setProfile({ nativeLanguage: profile.nativeLanguage === code ? null : code })}
                />
              ))}
          </Wrap>
        </SettingRow>
      </Card>

      <SectionHeader title="Daily rhythm" />
      <Card>
        <SettingRow label="Daily goal" hint="Micro lessons per day.">
          <Stepper label="Daily goal" value={settings.dailyGoal} min={1} max={60} onChange={(v) => set({ dailyGoal: v })} />
        </SettingRow>
        <SettingRow label="New items per day" hint="Reviews always come first. New items pause when many reviews are due.">
          <Stepper
            label="New items per day"
            value={settings.newItemsPerDay}
            min={0}
            max={30}
            onChange={(v) => set({ newItemsPerDay: v })}
          />
        </SettingRow>
        <SettingRow label="Session length" hint="Moments in a Today’s learning session.">
          <Stepper label="Session length" value={settings.sessionSize} min={3} max={30} onChange={(v) => set({ sessionSize: v })} />
        </SettingRow>
        <SettingRow label="Weekly review day">
          <Wrap>
            {WEEKDAYS.map((day, index) => (
              <Chip key={day} label={day} selected={settings.weeklyReviewDay === index} onPress={() => set({ weeklyReviewDay: index })} />
            ))}
          </Wrap>
        </SettingRow>
        <WeeklyReminderSetting settings={settings} onChange={set} />
      </Card>

      <SectionHeader title="Daily moments" />
      <Card onPress={() => router.push('/alarms')} accessibilityLabel="Manage alarms">
        <Text variant="bodyStrong">Learn-to-dismiss alarms</Text>
        <Text tone="muted">Create alarms, choose how many questions stop them, and check alarm permissions.</Text>
      </Card>

      <Card onPress={() => router.push('/unlock-settings')} accessibilityLabel="Unlock learning settings">
        <Text variant="bodyStrong">Unlock learning</Text>
        <Text tone="muted">
          {settings.unlock.enabled
            ? `On · up to ${settings.unlock.maxCardsPerDay} cards a day, ${settings.unlock.cooldownMinutes} min apart`
            : 'Off · small cards after you unlock your phone'}
        </Text>
      </Card>

      <SectionHeader title="Audio" />
      <Card>
        <SettingRow label="Pronunciation speed">
          <Wrap>
            {SPEECH_RATES.map((rate) => (
              <Chip
                key={rate.label}
                label={rate.label}
                selected={Math.abs(settings.speechRate - rate.value) < 0.01}
                onPress={() => set({ speechRate: rate.value })}
              />
            ))}
          </Wrap>
        </SettingRow>
        <ToggleRow
          label="Play audio automatically"
          hint="Speak the word when a question with audio appears."
          value={settings.autoPlayAudio}
          onChange={(v) => set({ autoPlayAudio: v })}
        />
        <ToggleRow
          label="Speaking practice"
          hint={
            speechRecognitionProvider.isAvailable()
              ? 'Say a few words aloud in each session. Practice only: it never changes when words come back.'
              : 'Speech recognition is not available on this device.'
          }
          value={settings.speakingPractice && speechRecognitionProvider.isAvailable()}
          onChange={(enabled) => {
            if (!speechRecognitionProvider.isAvailable()) return;
            if (!enabled) set({ speakingPractice: false });
            else void speechRecognitionProvider.requestPermission().then((granted) => set({ speakingPractice: granted }));
          }}
        />
      </Card>

      <SectionHeader title="Appearance" />
      <Card>
        <Wrap>
          {(['system', 'light', 'dark'] as const).map((theme) => (
            <Chip
              key={theme}
              label={theme === 'system' ? 'System' : theme === 'light' ? 'Light' : 'Dark'}
              selected={settings.theme === theme}
              onPress={() => set({ theme })}
            />
          ))}
        </Wrap>
      </Card>

      <SectionHeader title="Data" />
      <Card>
        <Text tone="muted">
          Everything is stored on this device and works offline: content, progress, settings and your words.
        </Text>
        <Button label="Reset learning progress" variant="danger" size="md" onPress={confirmReset} loading={reset.isPending} />
      </Card>

      <Text variant="caption" tone="subtle" align="center">
        Unlock Lingo {Constants.expoConfig?.version ?? ''}
      </Text>
    </Screen>
  );
}
