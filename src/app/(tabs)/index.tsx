import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, ProgressBar, Screen, StatTile, Text } from '@/components';
import { describeRepeat, describeTimeUntil, formatAlarmTime } from '@/features/alarms/domain/schedule';
import { useNextAlarm } from '@/features/alarms/hooks';
import { useDashboard } from '@/features/learning/hooks';
import { useProfile, useSaveProfile } from '@/features/settings/hooks';
import { useTheme } from '@/theme/ThemeProvider';

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { colors, spacing } = useTheme();
  const { data } = useDashboard();
  const profile = useProfile().data;
  const saveProfile = useSaveProfile();
  const [now] = useState(Date.now);
  const nextAlarm = useNextAlarm(now);

  if (!data) return <Screen>{null}</Screen>;

  const { today, dailyGoal, dueCount, streak, levelPolicy } = data;
  const answered = today.correct + today.incorrect;
  const accuracy = answered === 0 ? '–' : `${Math.round((today.correct / answered) * 100)}%`;
  const date = new Date(now);
  const suggested = levelPolicy.suggestedLevel;

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" tone="muted">
          {date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        <Text variant="title">{greeting(date.getHours())}</Text>
      </View>

      <Card>
        <Text variant="label" tone="subtle">
          Today
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
          <Text variant="stat">{today.interactions}</Text>
          <Text tone="muted">/ {dailyGoal} micro lessons</Text>
        </View>
        <ProgressBar value={today.interactions / dailyGoal} />
        <Button
          label={dueCount > 0 ? `Review ${dueCount} due` : 'Start today’s learning'}
          icon="play"
          onPress={() => router.push('/session')}
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <StatTile label="Reviewed" value={String(today.reviews)} hint="words today" />
        <StatTile label="Accuracy" value={accuracy} hint="today" />
        <StatTile label="Streak" value={`${streak.current}`} hint={streak.current === 1 ? 'day' : 'days'} />
        <StatTile label="Due" value={String(dueCount)} hint="for review" />
      </View>

      {suggested && profile ? (
        <Card tone="accent">
          <Text variant="bodyStrong">You’re ready for {suggested}</Text>
          <Text tone="muted">
            You’ve answered {profile.currentLevel} and {suggested} material consistently well. Move your level up?
          </Text>
          <Button
            label={`Switch to ${suggested}`}
            variant="secondary"
            size="md"
            loading={saveProfile.isPending}
            onPress={() => saveProfile.mutate({ ...profile, currentLevel: suggested })}
          />
        </Card>
      ) : null}

      <Card onPress={() => router.push('/alarms')} accessibilityLabel="Alarms">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Ionicons name="alarm-outline" size={24} color={colors.textMuted} />
          <View style={{ flex: 1 }}>
            <Text variant="label" tone="subtle">
              Next alarm
            </Text>
            {nextAlarm ? (
              <>
                <Text variant="bodyStrong">
                  {formatAlarmTime(nextAlarm.alarm.hour, nextAlarm.alarm.minute)} · {describeTimeUntil(nextAlarm.at, now)}
                </Text>
                <Text variant="caption" tone="muted">
                  {describeRepeat(nextAlarm.alarm.days)} · {nextAlarm.alarm.questionCount} questions to dismiss
                </Text>
              </>
            ) : (
              <>
                <Text variant="bodyStrong">No alarm set</Text>
                <Text variant="caption" tone="muted">
                  Wake up with a few quick questions.
                </Text>
              </>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        </View>
      </Card>

      <Button label="Add a word" icon="add" variant="secondary" onPress={() => router.push('/words/add')} />
    </Screen>
  );
}
