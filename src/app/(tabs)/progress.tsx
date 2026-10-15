import { router } from 'expo-router';
import { View } from 'react-native';

import { Card, Chip, ProgressBar, Screen, SectionHeader, StatTile, Text } from '@/components';
import { accuracy } from '@/features/learning/domain/stats';
import { useProgressOverview } from '@/features/learning/hooks';
import { WeekChart } from '@/features/progress/WeekChart';
import { useSettings } from '@/features/settings/hooks';
import { useTheme } from '@/theme/ThemeProvider';

export default function ProgressScreen() {
  const { spacing } = useTheme();
  const { data } = useProgressOverview();
  const goal = useSettings().data?.dailyGoal ?? 10;
  if (!data) return <Screen>{null}</Screen>;

  const today = data.week[data.week.length - 1];
  const weekAccuracy = accuracy(data.weekTotals.correct, data.weekTotals.incorrect);

  return (
    <Screen>
      <Text variant="title">Progress</Text>

      <Card>
        <Text variant="label" tone="subtle">
          Last 7 days
        </Text>
        <WeekChart days={data.week} goal={goal} />
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <StatTile label="Today" value={String(today?.interactions ?? 0)} hint="moments" />
        <StatTile label="This week" value={String(data.weekTotals.interactions)} hint="moments" />
        <StatTile
          label="Accuracy"
          value={weekAccuracy === null ? '–' : `${Math.round(weekAccuracy * 100)}%`}
          hint="this week"
        />
        <StatTile label="Streak" value={String(data.streak.current)} hint={`best ${data.streak.longest}`} />
        <StatTile label="Mastered" value={String(data.statusCounts.mastered)} hint="items" />
        <StatTile label="Difficult" value={String(data.statusCounts.difficult)} hint="items" />
      </View>

      <SectionHeader title="Level progress" />
      <Card>
        {data.levels.map((level) => (
          <View key={level.level} style={{ gap: spacing.xs, paddingVertical: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodyStrong">{level.level}</Text>
              <Text tone="muted">
                {level.mastered} / {level.total} mastered
              </Text>
            </View>
            <ProgressBar value={level.total === 0 ? 0 : level.mastered / level.total} height={6} />
          </View>
        ))}
      </Card>

      {data.difficultItems.length > 0 ? (
        <>
          <SectionHeader title="Most difficult" />
          <Text variant="caption" tone="muted">
            These come back more often until they stick.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {data.difficultItems.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                onPress={() => router.push({ pathname: '/vocabulary/[id]', params: { id: item.id } })}
              />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
