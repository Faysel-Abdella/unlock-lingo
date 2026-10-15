import { router } from 'expo-router';
import { View } from 'react-native';

import { Card, Chip, ListGroup, ListRow, ProgressBar, Screen, SectionHeader, StatGrid, Text } from '@/components';
import { accuracy } from '@/features/learning/domain/stats';
import { useProgressOverview } from '@/features/learning/hooks';
import { WeekChart } from '@/features/progress/WeekChart';
import {
  type DifficultyStatus,
  type Trend,
  describeLevelMix,
  difficultyStatus,
  levelAccuracy,
  weeklyTrends,
} from '@/features/progress/domain/analytics';
import { useWeeklyHistory } from '@/features/reviews/hooks';
import { useProfile, useSettings } from '@/features/settings/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { parseDateKey } from '@/utils/date';

const percent = (value: number | null) => (value === null ? '–' : `${Math.round(value * 100)}%`);

const TREND_ICON: Record<Trend, 'trending-up' | 'trending-down' | 'remove'> = {
  up: 'trending-up',
  down: 'trending-down',
  steady: 'remove',
};

function weekLabel(start: string): string {
  return `Week of ${parseDateKey(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export default function ProgressScreen() {
  const { spacing } = useTheme();
  const { data } = useProgressOverview();
  const history = useWeeklyHistory().data ?? [];
  const goal = useSettings().data?.dailyGoal ?? 10;
  const currentLevel = useProfile().data?.currentLevel;
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

      <StatGrid
        stats={[
          { label: 'Today', value: String(today?.interactions ?? 0), hint: 'moments' },
          { label: 'This week', value: String(data.weekTotals.interactions), hint: 'moments' },
          { label: 'Accuracy', value: weekAccuracy === null ? '–' : `${Math.round(weekAccuracy * 100)}%`, hint: 'this week' },
          { label: 'Streak', value: String(data.streak.current), hint: `best ${data.streak.longest}` },
          { label: 'Mastered', value: String(data.statusCounts.mastered), hint: 'items' },
          { label: 'Difficult', value: String(data.statusCounts.difficult), hint: 'items' },
        ]}
      />

      <SectionHeader title="Level progress" />
      <Card>
        {data.levels.map((level) => {
          const recent = levelAccuracy(data.levelAccuracy, level.level);
          return (
            <View key={level.level} style={{ gap: spacing.xs, paddingVertical: spacing.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                <Text variant="bodyStrong">{level.level}</Text>
                <Text tone="muted">
                  {level.mastered} / {level.total} mastered
                </Text>
              </View>
              <ProgressBar value={level.total === 0 ? 0 : level.mastered / level.total} height={6} />
              <Text variant="caption" tone="subtle">
                {recent.reviews === 0
                  ? 'No answers in the last 30 days'
                  : `${percent(recent.accuracy)} correct · ${recent.reviews} answers in 30 days`}
              </Text>
            </View>
          );
        })}
      </Card>

      <SectionHeader title="Smart difficulty" />
      <Card>
        <Text variant="label" tone="subtle">
          New material
        </Text>
        <Text variant="bodyStrong">{describeLevelMix(data.levelPolicy.shares)}</Text>
        {currentLevel ? (
          <Text tone="muted">{difficultyExplanation(difficultyStatus(data.levelPolicy, data.levelAccuracy, currentLevel))}</Text>
        ) : null}
      </Card>

      {data.speaking.attempts > 0 ? (
        <>
          <SectionHeader title="Speaking practice" />
          <Card>
            <Text variant="bodyStrong">
              {data.speaking.clear} of {data.speaking.attempts} attempts understood clearly
            </Text>
            <Text variant="caption" tone="muted">
              Last 30 days. Speaking is practice only and never changes when words come back.
            </Text>
            {data.speaking.needsPractice.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {data.speaking.needsPractice.map((item) => (
                  <Chip
                    key={item.itemId}
                    label={item.expected}
                    onPress={() => router.push({ pathname: '/vocabulary/[id]', params: { id: item.itemId } })}
                  />
                ))}
              </View>
            ) : null}
          </Card>
        </>
      ) : null}

      {history.length > 0 ? (
        <>
          <SectionHeader title="Weekly reviews" />
          <ListGroup>
            {weeklyTrends(history).map(({ snapshot, accuracyTrend }, i) => (
              <ListRow
                key={snapshot.week.start}
                first={i === 0}
                icon={accuracyTrend ? TREND_ICON[accuracyTrend] : 'calendar-outline'}
                title={weekLabel(snapshot.week.start)}
                subtitle={`${snapshot.wordsEncountered} words · ${snapshot.grammarCompleted} grammar · ${snapshot.activeDays} active ${snapshot.activeDays === 1 ? 'day' : 'days'}`}
                value={percent(snapshot.accuracy)}
              />
            ))}
          </ListGroup>
        </>
      ) : null}

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

function difficultyExplanation(status: DifficultyStatus): string {
  switch (status.kind) {
    case 'suggest':
      return `You are doing well at ${status.level} too. Consider moving your level up in Settings.`;
    case 'mixing':
      return 'Mixed by your recent accuracy: harder material grows as you keep answering correctly, easier material helps when answers get tough.';
    case 'gathering':
      return `After ${status.needed} more answers at ${status.level}, new material adapts to how well you are doing.`;
    case 'steady':
      return `Keep your ${status.level} accuracy above 85% and the next level is mixed in gradually.`;
  }
}
