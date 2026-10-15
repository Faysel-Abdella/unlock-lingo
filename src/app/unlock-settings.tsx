import { View } from 'react-native';

import { Button, Card, Chip, Screen, SectionHeader, Text } from '@/components';
import { shortDayLabel } from '@/features/alarms/domain/schedule';
import { WEEKDAYS, type Weekday } from '@/features/alarms/domain/types';
import { requestNotificationPermission } from '@/features/alarms/hooks';
import { SettingRow, Stepper, ToggleRow } from '@/features/settings/components';
import { useSettings, useUpdateSettings } from '@/features/settings/hooks';
import { TimeOfDayField } from '@/features/unlock/components/TimeOfDayField';
import type { Frequency } from '@/features/unlock/domain/policy';
import {
  CARD_TYPES,
  COOLDOWN_RANGE,
  type CardType,
  MAX_CARDS_RANGE,
  type UnlockSettings,
} from '@/features/unlock/domain/settings';
import { useUnlockStatus } from '@/features/unlock/hooks';
import { unlockCards } from '@/native/unlockCards';
import { useTheme } from '@/theme/ThemeProvider';

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'low', label: 'Rarely' },
  { value: 'normal', label: 'Sometimes' },
  { value: 'high', label: 'Often' },
];

const CARD_TYPE_LABELS: Record<CardType, string> = { vocabulary: 'Words', phrase: 'Phrases', grammar: 'Grammar' };

export default function UnlockSettingsScreen() {
  const settings = useSettings().data;
  if (!settings) return <Screen edges={['bottom']}>{null}</Screen>;
  return <UnlockForm unlock={settings.unlock} />;
}

function Wrap({ children }: { children: React.ReactNode }) {
  const { spacing } = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{children}</View>;
}

function UnlockForm({ unlock }: { unlock: UnlockSettings }) {
  const update = useUpdateSettings();
  const status = useUnlockStatus().data;
  const set = (patch: Partial<UnlockSettings>) => update.mutate({ unlock: { ...unlock, ...patch } });

  const toggleEnabled = async (enabled: boolean) => {
    if (enabled) await requestNotificationPermission();
    set({ enabled });
  };

  const toggleType = (type: CardType) => {
    const next = unlock.cardTypes.includes(type) ? unlock.cardTypes.filter((t) => t !== type) : [...unlock.cardTypes, type];
    if (next.length > 0) set({ cardTypes: next });
  };

  const toggleWorkDay = (day: Weekday) => {
    const days = unlock.workHours.days.includes(day)
      ? unlock.workHours.days.filter((d) => d !== day)
      : [...unlock.workHours.days, day];
    set({ workHours: { ...unlock.workHours, days } });
  };

  return (
    <Screen edges={['bottom']}>
      <Text tone="muted">
        Small learning cards during the day. Each takes a few seconds. You decide how often they appear, and they
        never show during quiet hours.
      </Text>

      {!unlockCards.isAvailable ? (
        <Card tone="muted">
          <Text variant="bodyStrong">Needs the Android app</Text>
          <Text tone="muted">Unlock learning uses native Android features and works in the Android build.</Text>
        </Card>
      ) : null}

      <Card>
        <ToggleRow
          label="Unlock learning"
          hint={unlock.enabled ? 'On' : 'Off. Nothing appears until you turn it on.'}
          value={unlock.enabled}
          onChange={(v) => void toggleEnabled(v)}
        />
        {unlock.enabled && status && !status.notificationsEnabled ? (
          <Text tone="warning">Notifications are off for Unlock Lingo, so cards cannot appear.</Text>
        ) : null}
        {unlock.enabled && status ? (
          <Text variant="caption" tone="muted">
            {status.shownToday} of {unlock.maxCardsPerDay} cards shown today
            {unlock.mode === 'unlock' ? ` · listener ${status.listenerRunning ? 'running' : 'not running'}` : ''}
          </Text>
        ) : null}
      </Card>

      <SectionHeader title="How cards arrive" />
      <Card>
        <Wrap>
          <Chip label="After I unlock" selected={unlock.mode === 'unlock'} onPress={() => set({ mode: 'unlock' })} />
          <Chip label="Spread through the day" selected={unlock.mode === 'scheduled'} onPress={() => set({ mode: 'scheduled' })} />
        </Wrap>
        <Text variant="caption" tone="muted">
          {unlock.mode === 'unlock'
            ? 'Android does not let apps open a screen when you unlock. Instead, a quiet card appears in your notifications right after some unlocks. While this is on, Android shows a small permanent notification for Unlock Lingo.'
            : 'Cards arrive at spread-out times instead of right after unlocking. No permanent notification is needed.'}
        </Text>
      </Card>

      <SectionHeader title="How often" />
      <Card>
        <SettingRow label="Maximum cards per day">
          <Stepper
            label="Maximum cards per day"
            value={unlock.maxCardsPerDay}
            min={MAX_CARDS_RANGE.min}
            max={MAX_CARDS_RANGE.max}
            onChange={(maxCardsPerDay) => set({ maxCardsPerDay })}
          />
        </SettingRow>
        <SettingRow label="Minimum minutes between cards">
          <Stepper
            label="Minutes between cards"
            value={unlock.cooldownMinutes}
            min={COOLDOWN_RANGE.min}
            max={COOLDOWN_RANGE.max}
            step={5}
            onChange={(cooldownMinutes) => set({ cooldownMinutes })}
          />
        </SettingRow>
        {unlock.mode === 'unlock' ? (
          <>
            <SettingRow label="Frequency" hint="How likely an unlock is to show a card once the cooldown has passed.">
              <Wrap>
                {FREQUENCIES.map((f) => (
                  <Chip key={f.value} label={f.label} selected={unlock.frequency === f.value} onPress={() => set({ frequency: f.value })} />
                ))}
              </Wrap>
            </SettingRow>
            <ToggleRow
              label="A card after every unlock"
              hint="Ignores the cooldown and frequency. Quiet hours and the daily maximum still apply."
              value={unlock.everyUnlock}
              onChange={(everyUnlock) => set({ everyUnlock })}
            />
          </>
        ) : null}
      </Card>

      <SectionHeader title="When not to interrupt" />
      <Card>
        <ToggleRow
          label="Quiet hours"
          value={unlock.quietHours.enabled}
          onChange={(enabled) => set({ quietHours: { ...unlock.quietHours, enabled } })}
        />
        {unlock.quietHours.enabled ? (
          <>
            <TimeOfDayField label="From" value={unlock.quietHours.start} onChange={(start) => set({ quietHours: { ...unlock.quietHours, start } })} />
            <TimeOfDayField label="Until" value={unlock.quietHours.end} onChange={(end) => set({ quietHours: { ...unlock.quietHours, end } })} />
          </>
        ) : null}
        <ToggleRow
          label="Pause during work hours"
          value={unlock.workHours.enabled}
          onChange={(enabled) => set({ workHours: { ...unlock.workHours, enabled } })}
        />
        {unlock.workHours.enabled ? (
          <>
            <TimeOfDayField label="From" value={unlock.workHours.start} onChange={(start) => set({ workHours: { ...unlock.workHours, start } })} />
            <TimeOfDayField label="Until" value={unlock.workHours.end} onChange={(end) => set({ workHours: { ...unlock.workHours, end } })} />
            <Wrap>
              {WEEKDAYS.map((day) => (
                <Chip key={day} label={shortDayLabel(day)} selected={unlock.workHours.days.includes(day)} onPress={() => toggleWorkDay(day)} />
              ))}
            </Wrap>
          </>
        ) : null}
      </Card>

      <SectionHeader title="What appears" />
      <Card>
        <Wrap>
          {CARD_TYPES.map((type) => (
            <Chip key={type} label={CARD_TYPE_LABELS[type]} selected={unlock.cardTypes.includes(type)} onPress={() => toggleType(type)} />
          ))}
        </Wrap>
        <Text variant="caption" tone="muted">
          Words and phrases can be answered right from the notification. Grammar cards open the app for a quick question.
        </Text>
        <Button
          label="Show an example card"
          variant="secondary"
          size="md"
          disabled={!unlockCards.isAvailable}
          onPress={() =>
            void requestNotificationPermission().then(() =>
              unlockCards.preview({
                itemId: 'en-vocab-resilient',
                kind: 'flash',
                title: 'resilient',
                subtitle: '/rɪˈzɪliənt/ · adjective',
                body: 'able to recover quickly from difficulty',
                example: 'She remained resilient despite the setback.',
              }),
            )
          }
        />
      </Card>
    </Screen>
  );
}
