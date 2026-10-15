import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Card, Chip, Screen, Text, TextField } from '@/components';
import { AlarmSoundPicker } from '@/features/alarms/components/AlarmSoundPicker';
import { TimeField } from '@/features/alarms/components/TimeField';
import { describeRepeat, describeTimeUntil, nextOccurrence, shortDayLabel } from '@/features/alarms/domain/schedule';
import {
  ALARM_DEFAULTS,
  ALARM_EXERCISE_TYPES,
  type AlarmInput,
  MAX_SNOOZES_RANGE,
  QUESTION_COUNT_RANGE,
  SNOOZE_MINUTES_RANGE,
  WEEKDAYS,
  type Weekday,
} from '@/features/alarms/domain/types';
import { requestNotificationPermission, useAlarm, useDeleteAlarm, useSaveAlarm } from '@/features/alarms/hooks';
import { SettingRow, Stepper, ToggleRow } from '@/features/settings/components';
import { useTheme } from '@/theme/ThemeProvider';
import type { ExerciseType } from '@/types/learning';

const TYPE_LABELS: Partial<Record<ExerciseType, string>> = {
  meaning: 'Meaning',
  choose_word: 'Choose the word',
  fill_blank: 'Fill in the blank',
  synonym: 'Synonym',
  antonym: 'Antonym',
  translate: 'Translation',
  grammar_choice: 'Grammar',
  phrase_meaning: 'Phrases',
  listening: 'Listening',
};

export default function AlarmEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { data: existing, isPending } = useAlarm(isNew ? null : id);
  if (!isNew && isPending) return <Screen edges={['bottom']}>{null}</Screen>;
  return <AlarmForm id={isNew ? null : id} initial={existing ?? ALARM_DEFAULTS} />;
}

function AlarmForm({ id, initial }: { id: string | null; initial: AlarmInput }) {
  const { spacing } = useTheme();
  const navigation = useNavigation();
  const save = useSaveAlarm();
  const remove = useDeleteAlarm();
  const [form, setForm] = useState<AlarmInput>(() => ({ ...ALARM_DEFAULTS, ...initial }));
  const [now] = useState(Date.now);
  const set = (patch: Partial<AlarmInput>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    navigation.setOptions({ title: id ? 'Edit alarm' : 'New alarm' });
  }, [navigation, id]);

  const toggleDay = (day: Weekday) =>
    set({ days: form.days.includes(day) ? form.days.filter((d) => d !== day) : [...form.days, day] });

  const toggleType = (type: ExerciseType) =>
    set({
      challengeTypes: form.challengeTypes.includes(type)
        ? form.challengeTypes.filter((t) => t !== type)
        : [...form.challengeTypes, type],
    });

  const submit = async () => {
    await requestNotificationPermission();
    await save.mutateAsync({ id, input: { ...form, enabled: true } });
    router.back();
  };

  const confirmDelete = () =>
    Alert.alert('Delete alarm?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => id && remove.mutate(id, { onSuccess: () => router.back() }) },
    ]);

  const next = nextOccurrence({ ...form, enabled: true }, now);

  return (
    <Screen edges={['bottom']} footer={<Button label="Save alarm" onPress={submit} loading={save.isPending} />}>
      <TimeField hour={form.hour} minute={form.minute} onChange={(hour, minute) => set({ hour, minute })} />
      {next ? (
        <Text tone="muted" align="center">
          {describeRepeat(form.days)} · rings {describeTimeUntil(next, now)}
        </Text>
      ) : null}

      <Card>
        <SettingRow label="Repeat" hint={form.days.length === 0 ? 'Rings once, then turns itself off.' : undefined}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {WEEKDAYS.map((day) => (
              <Chip key={day} label={shortDayLabel(day)} selected={form.days.includes(day)} onPress={() => toggleDay(day)} />
            ))}
          </View>
        </SettingRow>
        <TextField label="Label" value={form.label} onChangeText={(label) => set({ label })} placeholder="Optional" maxLength={60} />
      </Card>

      <Card>
        <SettingRow label="Questions to stop the alarm" hint="Correct answers needed. Mistakes just bring another question.">
          <Stepper
            label="Questions"
            value={form.questionCount}
            min={QUESTION_COUNT_RANGE.min}
            max={QUESTION_COUNT_RANGE.max}
            onChange={(questionCount) => set({ questionCount })}
          />
        </SettingRow>
        <SettingRow label="Question types" hint="None selected means a mix of everything except listening.">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {ALARM_EXERCISE_TYPES.map((type) => (
              <Chip
                key={type}
                label={TYPE_LABELS[type] ?? type}
                selected={form.challengeTypes.includes(type)}
                onPress={() => toggleType(type)}
              />
            ))}
          </View>
        </SettingRow>
      </Card>

      <Card>
        <ToggleRow label="Snooze" value={form.snoozeEnabled} onChange={(snoozeEnabled) => set({ snoozeEnabled })} />
        {form.snoozeEnabled ? (
          <>
            <SettingRow label="Snooze length (minutes)">
              <Stepper
                label="Snooze minutes"
                value={form.snoozeMinutes}
                min={SNOOZE_MINUTES_RANGE.min}
                max={SNOOZE_MINUTES_RANGE.max}
                onChange={(snoozeMinutes) => set({ snoozeMinutes })}
              />
            </SettingRow>
            <SettingRow label="Snoozes allowed">
              <Stepper
                label="Snoozes allowed"
                value={form.maxSnoozes}
                min={MAX_SNOOZES_RANGE.min}
                max={MAX_SNOOZES_RANGE.max}
                onChange={(maxSnoozes) => set({ maxSnoozes })}
              />
            </SettingRow>
          </>
        ) : null}
        <AlarmSoundPicker value={form.sound} onChange={(sound) => set({ sound })} />
        <ToggleRow
          label="Gradually increase volume"
          hint="Starts quietly and reaches full volume over a minute."
          value={form.gradualVolume}
          onChange={(gradualVolume) => set({ gradualVolume })}
        />
        <ToggleRow label="Vibrate" value={form.vibrate} onChange={(vibrate) => set({ vibrate })} />
      </Card>

      <Text variant="caption" tone="muted">
        You can never get stuck: a press-and-hold emergency stop is always on the alarm screen, the notification
        offers an emergency stop after two minutes, and the alarm stops on its own after ten minutes.
      </Text>

      {save.error ? <Text tone="danger">{save.error.message}</Text> : null}
      {id ? <Button label="Delete alarm" variant="danger" onPress={confirmDelete} loading={remove.isPending} /> : null}
    </Screen>
  );
}
