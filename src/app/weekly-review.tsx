import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Chip, EmptyState, Screen, SectionHeader, StatGrid, Text } from '@/components';
import { WEEKLY_QUIZ_SIZE } from '@/features/reviews/domain/weekly';
import { useWeeklyReview } from '@/features/reviews/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { parseDateKey } from '@/utils/date';

function formatWeek(start: string, end: string): string {
  const fmt = (key: string) => parseDateKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function WeeklyReviewScreen() {
  const { spacing } = useTheme();
  const { data } = useWeeklyReview();
  if (!data) return <Screen edges={['bottom']}>{null}</Screen>;

  const { stats, completed, quizItemIds } = data;
  const quizSize = Math.min(quizItemIds.length, WEEKLY_QUIZ_SIZE);
  const accuracy = stats.accuracy === null ? '–' : `${Math.round(stats.accuracy * 100)}%`;
  const empty = stats.answers === 0;
  const openItem = (id: string) => router.push({ pathname: '/vocabulary/[id]', params: { id } });

  return (
    <Screen
      edges={['bottom']}
      footer={
        empty ? null : (
          <Button
            label={completed ? 'Practise again' : `Start review · about ${Math.max(5, Math.round(quizSize * 0.5))} min`}
            variant={completed ? 'secondary' : 'primary'}
            icon="play"
            disabled={quizSize === 0}
            onPress={() => router.push({ pathname: '/session', params: { kind: 'weekly' } })}
          />
        )
      }
    >
      <View style={{ gap: spacing.xs }}>
        <Text variant="label" tone="subtle">
          {formatWeek(stats.week.start, stats.week.end)}
        </Text>
        <Text variant="title" accessibilityRole="header">
          Your week
        </Text>
      </View>

      {empty ? (
        <EmptyState
          icon="calendar-outline"
          title="A quiet week"
          message="No learning was recorded this week. Your next weekly review will collect what you practise."
        />
      ) : (
        <>
          {completed ? (
            <Card tone="accent">
              <Text variant="bodyStrong">Review completed</Text>
              <Text tone="muted">
                {completed.quiz.correct} of {completed.quiz.questions} correct. You can practise again any time.
              </Text>
            </Card>
          ) : (
            <Text tone="muted">
              A short quiz of about {quizSize} questions, focused on the words you found hardest and the ones you
              learned this week.
            </Text>
          )}

          <StatGrid
            stats={[
              { label: 'Encountered', value: String(stats.wordsEncountered), hint: 'words & phrases' },
              { label: 'New', value: String(stats.newWordsLearned), hint: 'words learned' },
              { label: 'Reviewed', value: String(stats.wordsReviewed), hint: 'older words' },
              { label: 'Grammar', value: String(stats.grammarCompleted), hint: 'questions' },
              { label: 'Accuracy', value: accuracy, hint: 'this week' },
              { label: 'Streak', value: String(stats.streak), hint: `${stats.activeDays} active ${stats.activeDays === 1 ? 'day' : 'days'}` },
            ]}
          />

          {stats.mostDifficult.length > 0 ? (
            <>
              <SectionHeader title="Most difficult" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {stats.mostDifficult.map((item) => (
                  <Chip key={item.itemId} label={item.label} onPress={() => openItem(item.itemId)} />
                ))}
              </View>
            </>
          ) : null}

          {stats.mastered.length > 0 ? (
            <>
              <SectionHeader title="Mastered" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {stats.mastered.map((item) => (
                  <Chip key={item.itemId} label={item.label} selected onPress={() => openItem(item.itemId)} />
                ))}
              </View>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
