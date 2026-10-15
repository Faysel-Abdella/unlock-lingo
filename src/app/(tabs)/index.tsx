import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, ListGroup, ListRow, Screen, SectionHeader, SegmentedProgress, StatGrid, Text } from '@/components';
import { describeRepeat, describeTimeUntil, formatAlarmTime } from '@/features/alarms/domain/schedule';
import { useNextAlarm } from '@/features/alarms/hooks';
import { useDashboard } from '@/features/learning/hooks';
import { useProfile, useSaveProfile, useSettings } from '@/features/settings/hooks';
import { useTheme } from '@/theme/ThemeProvider';

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { colors, radius, spacing } = useTheme();
  const { data } = useDashboard();
  const profile = useProfile().data;
  const unlock = useSettings().data?.unlock;
  const saveProfile = useSaveProfile();
  const [now] = useState(Date.now);
  const nextAlarm = useNextAlarm(now);

  if (!data) return <Screen>{null}</Screen>;

  const { today, dailyGoal, dueCount, streak, levelPolicy, newRemainingToday } = data;
  const answered = today.correct + today.incorrect;
  const accuracy = answered === 0 ? '–' : `${Math.round((today.correct / answered) * 100)}%`;
  const date = new Date(now);
  const suggested = levelPolicy.suggestedLevel;
  const goalReached = today.interactions >= dailyGoal;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="label" tone="subtle">
            {date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <Text variant="title" accessibilityRole="header">
            {greeting(date.getHours())}
          </Text>
        </View>
        <View
          accessible
          accessibilityLabel={`${streak.current} day streak`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            backgroundColor: colors.warningSoft,
            borderRadius: radius.pill,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs + 2,
          }}
        >
          <Ionicons name="flame" size={16} color={colors.warning} />
          <Text variant="captionStrong" tone="warning">
            {streak.current} {streak.current === 1 ? 'day' : 'days'}
          </Text>
        </View>
      </View>

      <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
          <Text variant="display">{today.interactions}</Text>
          <Text variant="bodyLarge" tone="muted">
            of {dailyGoal} micro lessons today
          </Text>
        </View>
        <SegmentedProgress done={today.interactions} goal={dailyGoal} label={`${today.interactions} of ${dailyGoal} micro lessons`} />
        <Text variant="caption" tone="muted">
          {goalReached
            ? 'Daily goal reached. Anything more is a bonus.'
            : dueCount > 0
              ? `${dueCount} ${dueCount === 1 ? 'review is' : 'reviews are'} due · ${newRemainingToday} new words available`
              : `Nothing due · ${newRemainingToday} new words available`}
        </Text>
        <Button
          label={dueCount > 0 ? `Review ${dueCount} due` : 'Start today’s learning'}
          icon="play"
          onPress={() => router.push('/session')}
        />
      </View>

      <StatGrid
        stats={[
          { label: 'Reviewed', value: String(today.reviews), hint: 'words today' },
          { label: 'Accuracy', value: accuracy, hint: 'today' },
          { label: 'Due', value: String(dueCount), hint: 'for review' },
          { label: 'New', value: String(today.newItems), hint: 'words today' },
        ]}
      />

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

      <SectionHeader title="Daily moments" />
      <ListGroup>
        <ListRow
          first
          icon="alarm-outline"
          title={nextAlarm ? `${formatAlarmTime(nextAlarm.alarm.hour, nextAlarm.alarm.minute)} · ${describeTimeUntil(nextAlarm.at, now)}` : 'No alarm set'}
          subtitle={
            nextAlarm
              ? `${describeRepeat(nextAlarm.alarm.days)} · ${nextAlarm.alarm.questionCount} questions to dismiss`
              : 'Wake up with a few quick questions'
          }
          onPress={() => router.push('/alarms')}
        />
        <ListRow
          icon="phone-portrait-outline"
          title="Unlock learning"
          subtitle={unlock?.enabled ? `Up to ${unlock.maxCardsPerDay} cards a day` : 'Small cards when you pick up your phone'}
          value={unlock?.enabled ? 'On' : 'Off'}
          onPress={() => router.push('/unlock-settings')}
        />
      </ListGroup>

      <Button label="Add a word" icon="add" variant="secondary" onPress={() => router.push('/words/add')} />
    </Screen>
  );
}
